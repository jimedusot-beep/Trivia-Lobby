import express, { type Express } from "express";
import { randomUUID, createHash } from "node:crypto";
import { and, eq, desc, ilike, sum, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db";
import { libraryFiles, studySources } from "@shared/schema";
import { api } from "@shared/routes";
import { storage } from "./storage";
import { putPrivateObject, getPrivateObject, deletePrivateObject } from "./object-storage";
import { extractSource, sourcePreview } from "./source-extraction";
import { parseApkg, parseQtiFile } from "./portable-formats";
import { requireUser } from "./auth";
import { identifySource, previewSource, safeFilename, MAX_SOURCE_BYTES } from "./library-parse";

const MAX_ACCOUNT_BYTES = 100 * 1024 * 1024;
const libraryId = z.string().uuid();
const fileDetails = z.object({
  course: z.string().trim().max(100).optional(),
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
  const content = await getPrivateObject(file.objectKey);
  if (content.length !== file.sizeBytes || createHash("sha256").update(content).digest("hex") !== file.sha256)
    throw new Error("Source file integrity check failed");
  return content;
}
function publicMetadata(file: typeof libraryFiles.$inferSelect) {
  const { objectKey: _key, extractedText: _text, ...safe } = file;
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
        ilike(libraryFiles.originalName, pattern), ilike(libraryFiles.folder, pattern),
        sql`array_to_string(${libraryFiles.tags}, ' ') ILIKE ${pattern}`, ilike(libraryFiles.course, pattern),
        sql`to_tsvector('simple', ${libraryFiles.extractedText}) @@ websearch_to_tsquery('simple', ${q})`,
      )) : eq(libraryFiles.ownerId, req.studyUser!.id);
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
      const extraction = await extractSource(filename, bytes).catch(() => ({ text: "", status: "unsupported" }));
      const file=await db.transaction(async tx=>{
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${ownerId}),713)`);
        const [currentUsage]=await tx.select({total:sum(libraryFiles.sizeBytes)}).from(libraryFiles).where(eq(libraryFiles.ownerId,ownerId));
        if(Number(currentUsage?.total??0)+bytes.length>MAX_ACCOUNT_BYTES)throw Object.assign(new Error("Account source quota is 100 MB"),{status:413});
        path=key;
        await putPrivateObject(key,bytes,sha256);
        const [created]=await tx.insert(libraryFiles).values({
          ownerId,originalName:filename,mimeType,sizeBytes:bytes.length,sha256,objectKey:key,
          importStatus:"uploaded",extractedText:extraction.text,extractionStatus:extraction.status,
        }).returning();
        return created;
      });
      path = undefined;
      res.status(201).json(publicMetadata(file));
    } catch (err) {
      if (path) await deletePrivateObject(path).catch(() => {});
      if(err && typeof err==="object" && "status" in err && err.status===413){res.status(413).json({message:"Account source quota is 100 MB"});return;}
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
      const bytes = await original(file);
      const kind = identifySource(file.originalName,bytes).kind;
      let preview;
      if (kind === "pdf") preview = await sourcePreview(file.originalName,bytes);
      else if (kind === "apkg") preview = { cards:await parseApkg(bytes), support:"basic-anki-text" };
      else if (kind === "qti") preview = { cards:parseQtiFile(bytes).map(q=>{
        const a=q.answer;
        if(a.kind==="multiple_choice"){
          if(a.options.length>4) throw new Error("Unsupported QTI option count; up to four choices are supported by this importer");
          return {front:q.prompt,back:q.explanation||a.options.find(o=>o.id===a.correctOptionIds[0])!.label,type:"multiple_choice",options:a.options.map(o=>o.label),correctOption:String.fromCharCode(65+a.options.findIndex(o=>o.id===a.correctOptionIds[0]))};
        }
        return {front:q.prompt,back:"acceptedAnswers" in a ? a.acceptedAnswers[0] : "",type:"flashcard",options:[],correctOption:null};
      }), support:"qti-2.1-single-choice-short-answer" };
      else preview = previewSource(file.originalName,bytes);
      res.setHeader("Cache-Control", "private, no-store");
      res.json(preview);
    } catch (e) { if (!invalid(e, res)) next(e); }
  });

  app.get("/api/library/files/:id/media",requireUser,async(req,res,next)=>{
    try{
      const file=await ownedFile(req.studyUser!.id,String(req.params.id));
      if(!file||!["image/png","image/jpeg","image/webp"].includes(file.mimeType)){res.status(404).json({message:"Image not found"});return;}
      res.setHeader("Cache-Control","private, no-store");res.setHeader("X-Content-Type-Options","nosniff");res.type(file.mimeType).send(await original(file));
    }catch(e){next(e);}
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

  app.post("/api/library/files/:id/study-source", requireUser, async (req,res,next)=>{
    try {
      const file=await ownedFile(req.studyUser!.id,String(req.params.id));
      if(!file){res.status(404).json({message:"File not found"});return;}
      if(file.extractedText.trim().length<80){res.status(422).json({message:"This document needs at least 80 characters of extracted text. Add an accessible text source or transcribe the scan."});return;}
      const [existing]=await db.select().from(studySources).where(and(eq(studySources.userId,req.studyUser!.id),eq(studySources.fileId,file.id)));
      if(existing){res.json(existing);return;}
      const [source]=await db.insert(studySources).values({id:randomUUID(),userId:req.studyUser!.id,fileId:file.id,title:file.originalName.slice(0,120),body:file.extractedText.slice(0,20000)}).returning();
      res.status(201).json(source);
    }catch(e){next(e);}
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
      await deletePrivateObject(deleted.objectKey).catch(() => console.error("Orphan object cleanup needed"));
      res.status(204).send();
    } catch (e) { next(e); }
  });
}
