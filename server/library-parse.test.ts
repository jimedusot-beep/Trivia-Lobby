import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, createHash } from "node:crypto";
import { safeFilename, identifySource, inspectArchive, previewSource } from "./library-parse";
import { getCookie, hashPassword, verifyPassword, hashSessionToken } from "./auth-crypto";

// Construct tiny uncompressed ZIP files without downloading dependencies or fixtures.
function simpleZip(name: string, data: string): Buffer {
  const filename = Buffer.from(name);
  const body = Buffer.from(data);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt32LE(body.length, 18);
  local.writeUInt32LE(body.length, 22);
  local.writeUInt16LE(filename.length, 26);
  const dir = Buffer.alloc(46);
  dir.writeUInt32LE(0x02014b50, 0);
  dir.writeUInt16LE(20, 4);
  dir.writeUInt16LE(20, 6);
  dir.writeUInt32LE(body.length, 20);
  dir.writeUInt32LE(body.length, 24);
  dir.writeUInt16LE(filename.length, 28);
  const offset = 30 + filename.length + body.length;
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(dir.length + filename.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([local, filename, body, dir, filename, end]);
}

describe("Phase 3 private source validation", () => {
  it("retains exact CSV data and previews a legitimate backed-up deck", () => {
    const bytes = Buffer.from("Front,Back\nQuestion,Answer");
    assert.equal(identifySource("deck.csv", bytes).mimeType, "text/csv");
    assert.deepEqual(previewSource("deck.csv", bytes).cards.map(x => x.front), ["Question"]);
  });
  it("creates text-pair suggestions with line hints but no invented page citations", () => {
    const preview = previewSource("lecture.md", Buffer.from("# Topic\nQuestion :: Answer\nAnother\tResponse"));
    assert.equal(preview.support, "line-pairs");
    assert.equal(preview.cards.length, 2);
    assert.equal(preview.cards[0].sourceRef, "line 2");
  });
  it("treats PDFs and nonparsed assessment archives as manual-only", () => {
    assert.equal(previewSource("scan.pdf", Buffer.from("%PDF-1.7\n%%EOF")).support, "manual-only");
    assert.equal(previewSource("deck.apkg", simpleZip("collection.anki2", "testing")).support, "manual-only");
  });
  it("supports bounded DOCX text extraction without trusting archive paths", () => {
    const archive = simpleZip("word/document.xml", "<w:p><w:t>Question :: Answer</w:t></w:p>");
    assert.equal(previewSource("course.docx", archive).cards[0].front, "Question");
  });
  it("blocks traversal, NUL, spoofed PDFs and XML entities", () => {
    assert.throws(() => inspectArchive(simpleZip("../evil.txt", "bad")), /Unsafe archive path/);
    assert.throws(() => safeFilename("../evil.txt"), /Invalid filename/);
    assert.throws(() => identifySource("file.pdf", Buffer.from("not pdf")), /Invalid PDF/);
    assert.throws(() => identifySource("file.qti", Buffer.from('<!DOCTYPE foo [<!ENTITY x "y">]><x/>')), /XML entities/);
    assert.throws(() => identifySource("evil.txt", Buffer.from([65, 0, 66])), /binary/);
  });
  it("rejects truncated ZIP metadata", () => {
    const file = simpleZip("valid.txt", "body");
    assert.equal(inspectArchive(file).length, 1);
    assert.throws(() => inspectArchive(file.subarray(0, file.length - 5)), /ZIP directory/);
  });
});
describe("Phase 3 authentication primitives", () => {
  it("hashes passwords with randomized salts and rejects invalid secrets", async () => {
    const a = await hashPassword("some sufficiently long secret");
    const b = await hashPassword("some sufficiently long secret");
    assert.notEqual(a, b);
    assert.equal(await verifyPassword("some sufficiently long secret", a), true);
    assert.equal(await verifyPassword("incorrect secret value", a), false);
    assert.equal(await verifyPassword("whatever", "invalid"), false);
  });
  it("accepts only properly formed session cookies and hashes rather than persisting the token", () => {
    const token = randomBytes(32).toString("hex");
    assert.equal(getCookie("foo=bar; tl_session=" + token), token);
    assert.equal(getCookie("tl_session=invalid"), undefined);
    assert.equal(hashSessionToken(token), createHash("sha256").update(token).digest("hex"));
    assert.notEqual(hashSessionToken(token), token);
  });
});
