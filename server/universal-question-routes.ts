import type { Express, Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireUser } from "./auth";
import { db } from "./db";
import { decks } from "@shared/schema";
import { and, eq, sql } from "drizzle-orm";
import { rememberQuestion } from "./question-memory";
import { universalQuestionSchema, gradeUniversalAnswer, withoutAnswerKeys } from "@shared/universal-questions";
import {
  deckExists, listUniversalQuestions, getUniversalQuestion, addUniversalQuestion,
  editUniversalQuestion, removeUniversalQuestion, reorderUniversalQuestions,
} from "./universal-question-store";

const idSchema = z.coerce.number().int().positive().safe();
const questionInput = universalQuestionSchema.omit({ id: true });
const reorderInput = z.object({ ids: z.array(z.number().int().positive()).max(500) });
function ids(req: Request) {
  return { deckId: idSchema.parse(req.params.deckId), questionId: req.params.questionId === undefined ? 0 : idSchema.parse(req.params.questionId) };
}
function failure(err: unknown, res: Response) {
  if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid question or response", details: err.issues });
  if (err instanceof Error && err.message === "Deck question limit is 500") return res.status(400).json({ message: err.message });
  if (err instanceof Error && err.message === "Reorder must contain exactly the deck question IDs") return res.status(400).json({ message: err.message });
  if (typeof err === "object" && err !== null && "code" in err && err.code === "23505") {
    return res.status(409).json({ message: "A question with the same prompt and type already exists in this deck" });
  }
  console.error("Universal question API failure", err instanceof Error ? err.name : "UnknownError");
  return res.status(500).json({ message: "Question operation failed" });
}
/** Owner-scoped authoring and solo grading; live rooms use their own safe protocol. */
export function registerUniversalQuestionRoutes(app: Express) {
  app.use("/api/decks/:deckId/questions", requireUser, async (req, res, next) => {
    try {
      const deckId = idSchema.parse(req.params.deckId);
      const [deck] = await db.select({ id: decks.id }).from(decks)
        .where(and(eq(decks.id, deckId), eq(decks.ownerId, req.studyUser!.id))).limit(1);
      if (!deck) { res.status(404).json({ message: "Deck not found" }); return; }
      next();
    } catch (err) { failure(err, res); }
  });
  app.get("/api/decks/:deckId/questions", async (req, res) => {
    try {
      const { deckId } = ids(req);
      if (!(await deckExists(deckId))) return res.status(404).json({ message: "Deck not found" });
      res.json(await listUniversalQuestions(deckId));
    } catch (err) { failure(err, res); }
  });
  app.get("/api/decks/:deckId/questions/practice", async (req, res) => {
    try {
      const { deckId } = ids(req);
      if (!(await deckExists(deckId))) return res.status(404).json({ message: "Deck not found" });
      const questions = await listUniversalQuestions(deckId);
      if(req.query.mode === "adaptive") {
        const owner=req.studyUser!.id;
        const states=await db.execute(sql`SELECT question_id,needs_work,due_at FROM question_schedule WHERE owner_id=${owner}`);
        const recent=await db.execute(sql`SELECT correct FROM question_attempts WHERE owner_id=${owner} ORDER BY created_at DESC LIMIT 20`);
        const accuracy=recent.rows.length?recent.rows.filter(r=>r.correct).length/recent.rows.length:0.5;
        const difficulty=accuracy<0.6?"easy":accuracy>=0.85?"hard":"medium";
        const rank=(q:typeof questions[number])=>{
          const state=states.rows.find(s=>s.question_id===q.id);
          return (state?.needs_work?100:!state?80:new Date(String(state.due_at)).getTime()<=Date.now()?60:0)+(q.question.difficulty===difficulty?10:0);
        };
        questions.sort((a,b)=>rank(b)-rank(a)||a.position-b.position);
      }
      res.json(questions.map(q => ({ id: q.id, deckId: q.deckId, position: q.position, question: withoutAnswerKeys(q.question) })));
    } catch (err) { failure(err, res); }
  });
  app.post("/api/decks/:deckId/questions", async (req, res) => {
    try {
      const { deckId } = ids(req);
      if (!(await deckExists(deckId))) return res.status(404).json({ message: "Deck not found" });
      const parsed = questionInput.parse(req.body);
      const question = universalQuestionSchema.parse({ ...parsed, id: randomUUID() });
      const saved = await addUniversalQuestion(deckId, question);
      res.status(201).json(saved);
    } catch (err) { failure(err, res); }
  });
  app.patch("/api/decks/:deckId/questions/reorder", async (req, res) => {
    try {
      const { deckId } = ids(req);
      if (!(await deckExists(deckId))) return res.status(404).json({ message: "Deck not found" });
      const { ids: questionIds } = reorderInput.parse(req.body);
      await reorderUniversalQuestions(deckId, questionIds);
      res.json(await listUniversalQuestions(deckId));
    } catch (err) { failure(err, res); }
  });
  app.patch("/api/decks/:deckId/questions/:questionId", async (req, res) => {
    try {
      const { deckId, questionId } = ids(req);
      const existing = await getUniversalQuestion(deckId, questionId);
      if (!existing) return res.status(404).json({ message: "Question not found" });
      const question = universalQuestionSchema.parse({ ...questionInput.parse(req.body), id: existing.question.id });
      const saved = await editUniversalQuestion(deckId, questionId, question);
      res.json(saved);
    } catch (err) { failure(err, res); }
  });
  app.delete("/api/decks/:deckId/questions/:questionId", async (req, res) => {
    try {
      const { deckId, questionId } = ids(req);
      if (!(await removeUniversalQuestion(deckId, questionId))) return res.status(404).json({ message: "Question not found" });
      res.status(204).send();
    } catch (err) { failure(err, res); }
  });
  app.post("/api/decks/:deckId/questions/:questionId/check", async (req, res) => {
    try {
      const { deckId, questionId } = ids(req);
      const existing = await getUniversalQuestion(deckId, questionId);
      if (!existing) return res.status(404).json({ message: "Question not found" });
      // Authoritative scoring for solo practice only; not a competitive, anti-cheat endpoint.
      const {response,requestId,skipped} = z.object({ response: z.unknown(), requestId:z.string().uuid().default(randomUUID),skipped:z.boolean().default(false) }).parse(req.body);
      const correct = skipped?false:gradeUniversalAnswer(existing.question, response);
      const saved=await rememberQuestion(req.studyUser!.id,questionId,requestId,{response,skipped},correct,existing.question.answer);
      if(saved==="conflict"){res.status(409).json({message:"This answer request was already used for a different response"});return;}
      res.json({ correct, answer: existing.question.answer, explanation: existing.question.explanation ?? "", source:existing.question.source });
    } catch (err) { failure(err, res); }
  });
}
