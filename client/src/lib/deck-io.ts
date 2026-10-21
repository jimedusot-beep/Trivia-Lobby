import Papa from "papaparse";
import type { Card, Deck } from "@shared/schema";

/** Portable Trivia Lobby deck format. Does not include personal data or original uploads. */
export const DECK_BACKUP_FORMAT = "trivia-lobby-deck-v1" as const;
export const MAX_DECK_CARDS = 5000;
export const MAX_DECK_FILE_BYTES = 2 * 1024 * 1024;

export type ImportableCard = {
  front: string;
  back: string;
  type: "flashcard" | "multiple_choice";
  options: string[];
  correctOption: string | null;
};

export type ParsedDeck = {
  title?: string;
  description?: string;
  category?: string;
  cards: ImportableCard[];
};

type ExportCard = Pick<Card, "front" | "back" | "type" | "options" | "correctOption">;
type ExportDeck = Pick<Deck, "title" | "description" | "category"> & { cards: ExportCard[] };

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeCard(value: unknown, index: number): ImportableCard {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Row ${index + 1} is not a card.`);
  }
  const row = value as Record<string, unknown>;
  const front = clean(row.front);
  const back = clean(row.back);
  const type = clean(row.type).toLowerCase() || "flashcard";
  if (!front || !back) throw new Error(`Row ${index + 1}: front and back are required.`);
  if (front.length > 10000 || back.length > 10000) {
    throw new Error(`Row ${index + 1}: question or answer exceeds 10,000 characters.`);
  }
  if (type !== "flashcard" && type !== "multiple_choice") {
    throw new Error(`Row ${index + 1}: unknown card type "${type}".`);
  }
  const options = Array.isArray(row.options)
    ? row.options.map(clean).filter(Boolean)
    : [];
  if (options.length > 4) throw new Error(`Row ${index + 1}: maximum 4 options.`);
  const rawAnswer = clean(row.correctOption);
  let correctOption: string | null = null;
  if (type === "multiple_choice") {
    if (options.length < 2) throw new Error(`Row ${index + 1}: multiple choice requires 2–4 options.`);
    const candidate = rawAnswer.toUpperCase();
    const letterIndex = ["A", "B", "C", "D"].indexOf(candidate);
    const correctIndex = letterIndex >= 0 ? letterIndex : options.findIndex(o => o === rawAnswer);
    if (correctIndex < 0 || correctIndex >= options.length) {
      throw new Error(`Row ${index + 1}: correct answer must match A–D or an option's exact text.`);
    }
    correctOption = ["A", "B", "C", "D"][correctIndex];
  }
  return { front, back, type, options, correctOption };
}

function checkCards(cards: unknown): ImportableCard[] {
  if (!Array.isArray(cards) || cards.length === 0) throw new Error("No study cards were found.");
  if (cards.length > MAX_DECK_CARDS) throw new Error(`Maximum ${MAX_DECK_CARDS} cards per import.`);
  return cards.map(normalizeCard);
}

export function parseDeckContent(content: string, filename: string): ParsedDeck {
  if (!content.trim()) throw new Error("The selected file is empty.");
  if (new TextEncoder().encode(content).byteLength > MAX_DECK_FILE_BYTES) {
    throw new Error("File is larger than 2 MB.");
  }

  if (/\.json$/i.test(filename)) {
    let value: unknown;
    try { value = JSON.parse(content.replace(/^\uFEFF/, "")); }
    catch { throw new Error("Invalid JSON. Import a Trivia Lobby deck backup."); }
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("The JSON file is not a deck backup.");
    }
    const backup = value as Record<string, unknown>;
    if (backup.format !== DECK_BACKUP_FORMAT) {
      throw new Error("Unsupported JSON backup format.");
    }
    return {
      title: clean(backup.title),
      description: clean(backup.description),
      category: clean(backup.category),
      cards: checkCards(backup.cards),
    };
  }

  if (!/\.(csv|tsv)$/i.test(filename)) throw new Error("Choose a .csv, .tsv, or Trivia Lobby .json backup.");
  const parsed = Papa.parse<Record<string, string>>(content.replace(/^\uFEFF/, ""), {
    header: true,
    skipEmptyLines: "greedy",
    delimiter: /\.tsv$/i.test(filename) ? "\t" : "",
    transformHeader: (header: string) => header.trim().toLowerCase().replace(/[\s_-]/g, ""),
  });
  if (parsed.errors.length) throw new Error(`Invalid table format: ${parsed.errors[0].message}`);
  if (!parsed.meta.fields?.includes("front") && !parsed.meta.fields?.includes("question")) {
    throw new Error("Missing Front or Question header.");
  }
  if (!parsed.meta.fields?.includes("back") && !parsed.meta.fields?.includes("answer")) {
    throw new Error("Missing Back or Answer header.");
  }
  const cards = parsed.data.map((row) => {
    const options = [row.optiona, row.optionb, row.optionc, row.optiond].map(clean).filter(Boolean);
    return {
      front: row.front || row.question,
      back: row.back || row.answer,
      type: row.type || "flashcard",
      options,
      correctOption: row.correctoption || null,
    };
  });
  return { cards: checkCards(cards) };
}

function exportCard(card: ExportCard): ImportableCard {
  const options = Array.isArray(card.options) ? card.options.map(clean).filter(Boolean) : [];
  return normalizeCard({
    front: card.front,
    back: card.back,
    type: card.type,
    options,
    correctOption: card.correctOption,
  }, 0);
}

export function exportDeckJson(deck: ExportDeck): string {
  return JSON.stringify({
    format: DECK_BACKUP_FORMAT,
    title: deck.title,
    description: deck.description ?? "",
    category: deck.category ?? "General",
    cards: deck.cards.map(exportCard),
  }, null, 2);
}

export function exportDeckCsv(deck: ExportDeck): string {
  const escape = (value: string): string => `"${value.replace(/"/g, '""')}"`;
  const header = "Front,Back,Type,OptionA,OptionB,OptionC,OptionD,CorrectOption";
  const rows = deck.cards.map((card) => {
    const safe = exportCard(card);
    return [
      safe.front, safe.back, safe.type,
      ...Array.from({ length: 4 }, (_, i) => safe.options[i] ?? ""),
      safe.correctOption ?? "",
    ].map(escape).join(",");
  });
  return [header, ...rows].join("\r\n");
}

export function downloadDeck(deck: ExportDeck, format: "json" | "csv") {
  const filename = deck.title.replace(/[^a-zA-Z0-9 _-]+/g, "").trim().replace(/\s+/g, "-") || "study-deck";
  const body = format === "json" ? exportDeckJson(deck) : exportDeckCsv(deck);
  const blob = new Blob([body], { type: format === "json" ? "application/json" : "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${filename}.${format}`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
