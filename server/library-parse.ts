import { inflateRawSync } from "node:zlib";
import { parseDeckContent, MAX_DECK_FILE_BYTES, type ImportableCard } from "../client/src/lib/deck-io";

export const MAX_SOURCE_BYTES = 8 * 1024 * 1024;
export type SourceKind = "csv" | "tsv" | "json" | "txt" | "md" | "pdf" | "docx" | "pptx" | "apkg" | "qti" | "h5p";
const mime: Record<SourceKind, string> = {
  csv: "text/csv", tsv: "text/tab-separated-values", json: "application/json",
  txt: "text/plain", md: "text/markdown", pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  apkg: "application/zip", qti: "application/xml", h5p: "application/zip",
};
const decoder = new TextDecoder("utf-8", { fatal: true });

export function safeFilename(name: string): string {
  if (!name || name.length > 180 || /[/\\\x00-\x1f]/.test(name) || name === "." || name === "..")
    throw new Error("Invalid filename");
  return name.trim();
}
function readText(bytes: Buffer): string {
  if (bytes.includes(0)) throw new Error("Unexpected binary data");
  const text = decoder.decode(bytes);
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error("XML entities are not allowed");
  return text;
}
type ZipEntry = { name: string; offset: number; compressed: number; expanded: number; method: number };
export function inspectArchive(bytes: Buffer): ZipEntry[] {
  if (bytes.length < 22) throw new Error("Invalid ZIP archive");
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (bytes.readUInt32LE(i) === 0x06054b50) { end = i; break; }
  }
  if (end < 0) throw new Error("ZIP directory not found");
  const count = bytes.readUInt16LE(end + 10);
  const length = bytes.readUInt32LE(end + 12);
  let offset = bytes.readUInt32LE(end + 16);
  if (!count || count > 1024 || offset + length > end) throw new Error("ZIP entry limit exceeded");
  const entries: ZipEntry[] = [];
  let total = 0;
  for (let i = 0; i < count; i++) {
    if (offset + 46 > bytes.length || bytes.readUInt32LE(offset) !== 0x02014b50)
      throw new Error("Corrupt ZIP directory");
    const flags = bytes.readUInt16LE(offset + 8);
    const method = bytes.readUInt16LE(offset + 10);
    const compressed = bytes.readUInt32LE(offset + 20);
    const expanded = bytes.readUInt32LE(offset + 24);
    const nameSize = bytes.readUInt16LE(offset + 28);
    const extraSize = bytes.readUInt16LE(offset + 30);
    const commentSize = bytes.readUInt16LE(offset + 32);
    const local = bytes.readUInt32LE(offset + 42);
    const endOfEntry = offset + 46 + nameSize + extraSize + commentSize;
    if (endOfEntry > bytes.length) throw new Error("Corrupt ZIP filename");
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameSize));
    if (!name || name.startsWith("/") || name.includes("\\") ||
        name.split("/").includes("..") || /^[A-Za-z]:/.test(name))
      throw new Error("Unsafe archive path");
    if ((flags & 1) || ![0, 8].includes(method) || compressed > MAX_SOURCE_BYTES ||
        expanded > MAX_SOURCE_BYTES || (compressed > 0 && expanded > compressed * 100))
      throw new Error("Archive compression limit exceeded");
    total += expanded;
    if (total > 16 * 1024 * 1024) throw new Error("Archive total expansion limit exceeded");
    entries.push({ name, offset: local, compressed, expanded, method });
    offset = endOfEntry;
  }
  if (offset !== bytes.readUInt32LE(end + 16) + length) throw new Error("ZIP directory length mismatch");
  return entries;
}
function zipText(bytes: Buffer, entry: ZipEntry): string {
  const at = entry.offset;
  if (at + 30 > bytes.length || bytes.readUInt32LE(at) !== 0x04034b50)
    throw new Error("ZIP local header missing");
  const begin = at + 30 + bytes.readUInt16LE(at + 26) + bytes.readUInt16LE(at + 28);
  if (begin + entry.compressed > bytes.length) throw new Error("Truncated ZIP member");
  const data = bytes.subarray(begin, begin + entry.compressed);
  const expanded = entry.method === 8 ? inflateRawSync(data, { maxOutputLength: MAX_SOURCE_BYTES + 1 }) : data;
  if (expanded.length !== entry.expanded) throw new Error("ZIP member size mismatch");
  return readText(expanded);
}

export function identifySource(filename: string, bytes: Buffer): { kind: SourceKind; mimeType: string } {
  const safe = safeFilename(filename);
  if (!bytes.length || bytes.length > MAX_SOURCE_BYTES) throw new Error("Files must be 1 byte to 8 MB");
  const ext = safe.split(".").pop()?.toLowerCase() as SourceKind;
  if (!ext || !Object.prototype.hasOwnProperty.call(mime, ext)) throw new Error("Unsupported source extension");
  if (ext === "pdf") {
    if (bytes.toString("ascii", 0, 5) !== "%PDF-") throw new Error("Invalid PDF signature");
  } else if (["docx", "pptx", "apkg", "h5p"].includes(ext) ||
    (ext === "qti" && bytes.toString("ascii", 0, 2) === "PK")) {
    if (bytes.toString("ascii", 0, 2) !== "PK") throw new Error("Invalid ZIP signature");
    inspectArchive(bytes);
  } else {
    readText(bytes);
  }
  return { kind: ext, mimeType: mime[ext] };
}
type PreviewCard = ImportableCard & { sourceRef?: string };
function textPairs(text: string): PreviewCard[] {
  const cards: PreviewCard[] = [];
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const match = /^(.*?)\s*(?:\t|\s+::\s+|\s+=>\s+)\s*(.+)$/.exec(line.trim().replace(/^[-*]\s+/, ""));
    if (!match || !match[1].trim() || !match[2].trim() || match[1].length > 10000 || match[2].length > 10000) continue;
    cards.push({ front: match[1].trim(), back: match[2].trim(), options: [], type: "flashcard", correctOption: null, sourceRef: "line " + (index + 1) });
    if (cards.length >= 5000) break;
  }
  return cards;
}
function xmlToText(xml: string): string {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error("Unsafe XML entity");
  return xml.replace(/<w:tab\s*\/>/g, "\t").replace(/<\/(?:w:p|a:p)>/g, "\n")
    .replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}
export function previewSource(filename: string, bytes: Buffer): { cards: PreviewCard[]; support: string } {
  const { kind } = identifySource(filename, bytes);
  if (kind === "csv" || kind === "tsv" || kind === "json") {
    if (bytes.length > MAX_DECK_FILE_BYTES) throw new Error("CSV/TSV/JSON import is limited to 2 MB");
    return { cards: parseDeckContent(readText(bytes), filename).cards, support: "structured" };
  }
  if (kind === "txt" || kind === "md") return { cards: textPairs(readText(bytes)), support: "line-pairs" };
  if (kind === "docx" || kind === "pptx") {
    const entries = inspectArchive(bytes);
    const matching = entries.filter(e => kind === "docx" ? e.name === "word/document.xml" :
      /^ppt\/slides\/slide[0-9]+\.xml$/.test(e.name)).slice(0, 250);
    const text = matching.map(e => xmlToText(zipText(bytes, e))).join("\n");
    return { cards: textPairs(text), support: "extracted-text-pairs" };
  }
  // PDF/Anki/QTI/H5P: private original retention only, no fabricated conversions.
  return { cards: [], support: "manual-only" };
}
