import express, { type Express } from "express";
import { randomUUID, createHash } from "node:crypto";


import { and, eq, desc, ilike, sum, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db";
import { libraryFiles, studySources } from "@shared/schema";
import { api } from "@shared/routes";
import { storage } from "./storage";
import { requireUser } from "./auth";
import { identifySource, safeFilename, MAX_SOURCE_BYTES } from "./library-parse";

import { selectedBackend, putObject, readObject, removeObject, type StorageBackend } from "./object-storage";
import { extractSource, sourcePreview } from "./source-extraction";

const MAX_ACCOUNT_BYTES = 100 * 1024 * 1024;
const libraryId = z.string().uuid();
const fileDetails = z.object({
  course: z.string().trim().max(120).optional(),
  folder: z.string().trim().min(1).max(100).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
}).strict();

async function ownedFile(ownerId: string, fileId: string) {
  if (!libraryId.safeParse(fileId).success) return undefined;
  const [file] = await db.select().from(libraryFiles)
    .where(and(eq(libraryFiles.id, fileId), eq(libraryFiles.ownerId, ownerId))).limit(1);
  return file;
}
async function original(file: typeof libraryFiles.$inferSelect): Promise<Buffer> {
  const content = await readObject(file.storageBackend, file.objectKey, file.sizeBytes);
  if (content.length !== file.sizeBytes || createHash("sha256").update(content).digest("hex") !== file.sha256)
    throw new Error("Source file integrity check failed");
  return content;
}
function publicMetadata(file: typeof libraryFiles.$inferSelect) {
  const { objectKey: _key, contentText: _text, ...safe } = file;
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
      const pattern = "%" + q + "%";
      const condition = q ? and(eq(libraryFiles.ownerId, req.studyUser!.id), or(
        ilike(libraryFiles.originalName, pattern), ilike(libraryFiles.folder, pattern), ilike(libraryFiles.course, pattern),
        sql`to_tsvector('simple', ${libraryFiles.contentText}) @@ plainto_tsquery('simple', ${q})`,
        sql`array_to_string(${libraryFiles.tags}, ' ') ILIKE ${pattern}`,
      )) : eq(libraryFiles.ownerId, req.studyUser!.id);
      const files = await db.select().from(libraryFiles).where(condition).orderBy(desc(libraryFiles.createdAt)).limit(500);
      res.json(files.map(publicMetadata));
    } catch (e) { next(e); }
  });

  app.post("/api/library/files", requireUser, express.raw({ type: "application/octet-stream", limit: MAX_SOURCE_BYTES }), async (req, res, next) => {
    let savedKey: string | undefined;
    const backend = selectedBackend();
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
      let contentText = "";
      try { contentText = await extractSource(filename, bytes); } catch { /* Retain originals even if extraction is unavailable. */ }
      await putObject(backend, key, bytes); savedKey = key;
      const file = await db.transaction(async tx=>{
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${ownerId}), 913004)`);
        const [duplicate]=await tx.select({id:libraryFiles.id}).from(libraryFiles).where(and(eq(libraryFiles.ownerId,ownerId),eq(libraryFiles.sha256,sha256)));
        if(duplicate)throw Object.assign(new Error("Identical source already uploaded"),{status:409});
        const [usage]=await tx.select({total:sum(libraryFiles.sizeBytes)}).from(libraryFiles).where(eq(libraryFiles.ownerId,ownerId));
        if(Number(usage?.total??0)+bytes.length>MAX_ACCOUNT_BYTES)throw Object.assign(new Error("Account source quota is 100 MB"),{status:413});
        const [created]=await tx.insert(libraryFiles).values({ownerId,originalName:filename,mimeType,sizeBytes:bytes.length,sha256,objectKey:key,
          importStatus:"uploaded",storageBackend:backend,contentText}).returning();
        return created;
      });
      savedKey = undefined;
      res.status(201).json(publicMetadata(file));
    } catch (err) {
      if (savedKey) await removeObject(backend, savedKey).catch(() => {});
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

  app.get("/api/library/files/:id/image", requireUser, async (req, res, next) => {
    try {
      const file = await ownedFile(req.studyUser!.id, String(req.params.id));
      if (!file || !["image/png", "image/jpeg", "image/webp"].includes(file.mimeType)) { res.status(404).json({message:"Image not found"}); return; }
      res.setHeader("Content-Type", file.mimeType);
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.send(await original(file));
    } catch (e) { next(e); }
  });
  app.post("/api/library/files/:id/ai-source", requireUser, async (req, res, next) => {
    try {
      const file = await ownedFile(req.studyUser!.id, String(req.params.id));
      if (!file) { res.status(404).json({message:"File not found"}); return; }
      if (file.contentText.trim().length < 80) { res.status(422).json({message:"Insufficient extracted text; scanned images require manual text or OCR"}); return; }
      const [source] = await db.insert(studySources).values({id:randomUUID(),userId:req.studyUser!.id,
        title:file.originalName,body:file.contentText.slice(0,20000),fileId:file.id}).returning();
      res.status(201).json(source);
    } catch (e) { next(e); }
  });
  app.get("/api/library/files/:id/preview", requireUser, async (req, res, next) => {
    try {
      const file = await ownedFile(req.studyUser!.id, String(req.params.id));
      if (!file) { res.status(404).json({ message: "File not found" }); return; }
      const preview = await sourcePreview(file.originalName, await original(file), file.contentText);
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
      const result = await storage.importDeck(input.deck, input.cards, req.studyUser!.id, file.id, input.questions);
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
      await removeObject(deleted.storageBackend, deleted.objectKey).catch(err => console.error("Orphan object cleanup needed:", err));
      res.status(204).send();
    } catch (e) { next(e); }
  });
}
