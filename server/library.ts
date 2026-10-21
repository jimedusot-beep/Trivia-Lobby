import express, { type Express } from "express";
import { randomUUID, createHash } from "node:crypto";
import { readFile, mkdir, writeFile, unlink } from "node:fs/promises";
import { isAbsolute, join, resolve, sep } from "node:path";
import { and, eq, desc, ilike, sum } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db";
import { libraryFiles } from "@shared/schema";
import { api } from "@shared/routes";
import { storage } from "./storage";
import { requireUser } from "./auth";
import { identifySource, previewSource, safeFilename, MAX_SOURCE_BYTES } from "./library-parse";

const MAX_ACCOUNT_BYTES = 100 * 1024 * 1024;
const libraryId = z.string().uuid();
const fileDetails = z.object({
  folder: z.string().trim().min(1).max(100).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
}).strict();

// Private, durable, shared volume required. Never use the Vite public tree or deployment build output.
function privateRoot(): string {
  const value = process.env.PRIVATE_STORAGE_DIR;
  if (!value || !isAbsolute(value)) throw new Error("PRIVATE_STORAGE_DIR must be an absolute path on a persistent, private volume");
  const root = resolve(value);
  const cwd = resolve(process.cwd());
  if (root === cwd || root.startsWith(cwd + sep) || cwd.startsWith(root + sep))
    throw new Error("PRIVATE_STORAGE_DIR must be outside the application tree");
  return root;
}
function objectPath(key: string): string {
  if (!/^[a-f0-9-]{36}\/[a-f0-9-]{36}\.blob$/.test(key)) throw new Error("Unsafe object key");
  return join(privateRoot(), key);
}
async function ownedFile(ownerId: string, fileId: string) {
  if (!libraryId.safeParse(fileId).success) return undefined;
  const [file] = await db.select().from(libraryFiles)
    .where(and(eq(libraryFiles.id, fileId), eq(libraryFiles.ownerId, ownerId))).limit(1);
  return file;
}
async function original(file: typeof libraryFiles.$inferSelect): Promise<Buffer> {
  const content = await readFile(objectPath(file.objectKey));
  if (content.length !== file.sizeBytes || createHash("sha256").update(content).digest("hex") !== file.sha256)
    throw new Error("Source file integrity check failed");
  return content;
}
function publicMetadata(file: typeof libraryFiles.$inferSelect) {
  const { objectKey: _key, ...safe } = file;
  return safe;
}
function invalid(err: unknown, res: express.Response): boolean {
  if (err instanceof z.ZodError) { res.status(400).json({ message: err.message }); return true; }
  if (err instanceof Error && /^(Invalid|Unsupported|Unexpected|Unsafe|Corrupt|Truncated|ZIP|Archive|File|Files|Source|CSV|XML)/.test(err.message)) {
    res.status(422).json({ message: err.message }); return true;
  }
  return false;
}
export function registerLibraryRoutes(app: Express): void {
  app.get("/api/library/files", requireUser, async (req, res, next) => {
    try {
      const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
      const condition = q ? and(eq(libraryFiles.ownerId, req.studyUser!.id), ilike(libraryFiles.originalName, "%" + q + "%")) : eq(libraryFiles.ownerId, req.studyUser!.id);
      const files = await db.select().from(libraryFiles).where(condition).orderBy(desc(libraryFiles.createdAt)).limit(500);
      res.json(files.map(publicMetadata));
    } catch (e) { next(e); }
  });

  app.post("/api/library/files", requireUser, express.raw({ type: "application/octet-stream", limit: MAX_SOURCE_BYTES }), async (req, res, next) => {
    let path: string | undefined;
    try {
      if (!Buffer.isBuffer(req.body)) { res.status(415).json({ message: "Send application/octet-stream" }); return; }
      const encoded = req.get("x-filename");
      if (!encoded) { res.status(400).json({ message: "X-Filename required" }); return; }
      const filename = safeFilename(decodeURIComponent(encoded));
      const bytes: Buffer = req.body;
      const { mimeType } = identifySource(filename, bytes);
      const sha256 = createHash("sha256").update(bytes).digest("hex");
      const ownerId = req.studyUser!.id;
      const [duplicate] = await db.select({ id: libraryFiles.id }).from(libraryFiles)
        .where(and(eq(libraryFiles.ownerId, ownerId), eq(libraryFiles.sha256, sha256))).limit(1);
      if (duplicate) { res.status(409).json({ message: "Identical source already uploaded", fileId: duplicate.id }); return; }
      const [usage] = await db.select({ total: sum(libraryFiles.sizeBytes) }).from(libraryFiles).where(eq(libraryFiles.ownerId, ownerId));
      if (Number(usage?.total || 0) + bytes.length > MAX_ACCOUNT_BYTES) {
        res.status(413).json({ message: "Account source quota is 100 MB" }); return;
      }
      const key = ownerId + "/" + randomUUID() + ".blob";
      path = objectPath(key);
      await mkdir(join(privateRoot(), ownerId), { recursive: true, mode: 0o700 });
      await writeFile(path, bytes, { flag: "wx", mode: 0o600 });
      const [file] = await db.insert(libraryFiles).values({
        ownerId, originalName: filename, mimeType, sizeBytes: bytes.length, sha256, objectKey: key,
        importStatus: "uploaded",
      }).returning();
      path = undefined;
      res.status(201).json(publicMetadata(file));
    } catch (err) {
      if (path) await unlink(path).catch(() => {});
      if (err && typeof err === "object" && "code" in err && err.code === "23505") {
        res.status(409).json({ message: "Identical source already uploaded" }); return;
      }
      if (!invalid(err, res)) next(err);
    }
  });

  app.get("/api/library/files/:id/original", requireUser, async (req, res, next) => {
    try {
      const file = await ownedFile(req.studyUser!.id, String(req.params.id));
      if (!file) { res.status(404).json({ message: "File not found" }); return; }
      const data = await original(file);
      res.setHeader("Content-Type", "application/octet-stream");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Security-Policy", "sandbox");
      res.setHeader("Cache-Control", "private, no-store");
      res.setHeader("Content-Disposition", "attachment; filename*=UTF-8''" + encodeURIComponent(file.originalName));
      res.send(data);
    } catch (e) { next(e); }
  });

  app.get("/api/library/files/:id/preview", requireUser, async (req, res, next) => {
    try {
      const file = await ownedFile(req.studyUser!.id, String(req.params.id));
      if (!file) { res.status(404).json({ message: "File not found" }); return; }
      const preview = previewSource(file.originalName, await original(file));
      res.setHeader("Cache-Control", "private, no-store");
      res.json(preview);
    } catch (e) { if (!invalid(e, res)) next(e); }
  });

  app.post("/api/library/files/:id/decks", requireUser, async (req, res, next) => {
    try {
      const file = await ownedFile(req.studyUser!.id, String(req.params.id));
      if (!file) { res.status(404).json({ message: "File not found" }); return; }
      // Cards are explicitly reviewed/edited by the owner before any persistent import.
      const input = api.decks.import.input.parse(req.body);
      if (!input.deck.title?.trim() || input.deck.title.length > 200 || input.cards.some(c =>
        !c.front?.trim() || !c.back?.trim() || c.front.length > 10000 || c.back.length > 10000 ||
        !["flashcard", "multiple_choice"].includes(c.type || "flashcard"))) {
        res.status(400).json({ message: "Invalid reviewed deck or card contents" }); return;
      }
      const result = await storage.importDeck(input.deck, input.cards, req.studyUser!.id, file.id);
      res.status(201).json(result);
    } catch (e) { if (!invalid(e, res)) next(e); }
  });

  app.patch("/api/library/files/:id", requireUser, async (req, res, next) => {
    try {
      if (!libraryId.safeParse(String(req.params.id)).success) { res.status(404).json({ message: "File not found" }); return; }
      const input = fileDetails.parse(req.body);
      const [file] = await db.update(libraryFiles).set(input)
        .where(and(eq(libraryFiles.id, String(req.params.id)), eq(libraryFiles.ownerId, req.studyUser!.id))).returning();
      if (!file) { res.status(404).json({ message: "File not found" }); return; }
      res.json(publicMetadata(file));
    } catch (e) { if (!invalid(e, res)) next(e); }
  });

  app.delete("/api/library/files/:id", requireUser, async (req, res, next) => {
    try {
      if (!libraryId.safeParse(String(req.params.id)).success) { res.status(404).json({ message: "File not found" }); return; }
      const [deleted] = await db.delete(libraryFiles)
        .where(and(eq(libraryFiles.id, String(req.params.id)), eq(libraryFiles.ownerId, req.studyUser!.id))).returning();
      if (!deleted) { res.status(404).json({ message: "File not found" }); return; }
      // Database-first delete can leave an orphan object after a crash; reconcile in operations runbook.
      await unlink(objectPath(deleted.objectKey)).catch(err => console.error("Orphan object cleanup needed:", err));
      res.status(204).send();
    } catch (e) { next(e); }
  });
}
