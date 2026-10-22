import type { Express } from "express";
import { createServer, type Server } from "http";
import { attachGameSocket } from "./live-game";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { WS_EVENTS } from "@shared/schema";
import { z } from "zod";
import { requireUser, requireSameOrigin, registerAuthRoutes, resolveUser } from "./auth";
import { registerStudyRoutes } from "./study-routes";
import { registerUniversalQuestionRoutes } from "./universal-question-routes";
import { registerContentRoutes } from "./content-routes";
import { registerLibraryRoutes } from "./library";
import { rateLimit } from "./rate-limit";
import { pool } from "./db";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Require authenticated ownership for every deck/card request.
  app.use("/api", requireSameOrigin);
  app.use("/api", (_req, res, next) => { res.setHeader("Cache-Control", "private, no-store"); next(); });
  app.get("/api/health", async (_req, res) => {
    try { await pool.query("SELECT 1"); res.json({ status: "ok", database: "ok", protocol: 1 }); }
    catch { res.status(503).json({ status: "unavailable" }); }
  });
  app.use("/api", rateLimit(300));
  app.post(["/api/decks/import", "/api/library/files", "/api/library/files/:id/decks", "/api/study/drafts/generate"], rateLimit(15));
  registerAuthRoutes(app);
  app.get(api.decks.list.path, requireUser, async (req, res, next) => {
    try { res.json(await storage.getDecks(req.studyUser!.id)); } catch (e) { next(e); }
  });
  app.get(api.decks.get.path, requireUser, async (req, res, next) => {
    try {
      const deck = await storage.getDeck(Number(req.params.id), req.studyUser!.id);
      if (!deck) { res.status(404).json({ message: "Deck not found" }); return; }
      res.json(deck);
    } catch (e) { next(e); }
  });
  app.post(api.decks.create.path, requireUser, async (req, res, next) => {
    try { res.status(201).json(await storage.createDeck(api.decks.create.input.parse(req.body), req.studyUser!.id)); }
    catch (e) { if (e instanceof z.ZodError) res.status(400).json({ message: e.message }); else next(e); }
  });
  app.post(api.decks.import.path, requireUser, async (req, res, next) => {
    try {
      const input = api.decks.import.input.parse(req.body);
      res.status(201).json(await storage.importDeck(input.deck, input.cards, req.studyUser!.id, undefined, input.questions));
    } catch (e) { if (e instanceof z.ZodError) res.status(400).json({ message: e.message }); else next(e); }
  });
  app.post(api.cards.create.path, requireUser, async (req, res, next) => {
    try {
      const input = api.cards.create.input.parse(req.body);
      res.status(201).json(await storage.createCards(Number(req.params.id), input, req.studyUser!.id));
    } catch (e) {
      if (e instanceof z.ZodError) res.status(400).json({ message: e.message });
      else if (e instanceof Error && e.message === "Deck not found") res.status(404).json({ message: e.message });
      else next(e);
    }
  });
  app.delete(api.decks.delete.path, requireUser, async (req, res, next) => {
    try {
      if (!await storage.deleteDeck(Number(req.params.id), req.studyUser!.id)) { res.status(404).json({ message: "Deck not found" }); return; }
      res.status(204).send();
    } catch (e) { next(e); }
  });
  registerContentRoutes(app);
  registerLibraryRoutes(app);
  registerStudyRoutes(app);
  registerUniversalQuestionRoutes(app);

  attachGameSocket(httpServer, storage, { resolveUser });
  return httpServer;
}
