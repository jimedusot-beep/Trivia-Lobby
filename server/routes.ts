import type { Express } from "express";
import type { Server } from "http";
import { attachGameSocket } from "./live-game";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { requireUser, requireSameOrigin, registerAuthRoutes, resolveUser } from "./auth";
import { registerUniversalQuestionRoutes } from "./universal-question-routes";
import { registerStudyRoutes } from "./study-routes";
import { registerLibraryRoutes } from "./library";
import { registerBackupRoutes } from "./backup-routes";
import { registerAuthorDraftRoutes } from "./author-drafts";
import { registerCardEditorRoutes } from "./card-editor";
import { universalGameCards } from "./live-question-adapter";
import { gameReportSink, registerGameReportRoutes } from "./game-reports";
import { registerAssignmentRoutes } from "./assignment-routes";
import { apiAbuseLimit } from "./rate-limit";
import { ODD_ONE_OUT_STARTER_TITLE, oddOneOutStarterCards } from "./odd-one-out-pack";
import type { RoomCheckpointStore } from "./room-checkpoints";

export async function registerRoutes(
  httpServer: Server,
  app: Express,
  checkpointStore?: RoomCheckpointStore,
): Promise<Server> {
  
  // Require authenticated ownership for every deck/card request.
  app.use("/api", requireSameOrigin);
  app.use("/api", apiAbuseLimit);
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
      res.status(201).json(await storage.importDeck(input.deck, input.cards, req.studyUser!.id));
    } catch (e) { if (e instanceof z.ZodError) res.status(400).json({ message: e.message }); else next(e); }
  });
  // Starter answers stay on the server; the caller never downloads unpublished keys.
  app.post("/api/odd-one-out/starter", requireUser, async (req, res, next) => {
    try {
      const ownerId=req.studyUser!.id;
      const title=ODD_ONE_OUT_STARTER_TITLE;
      // Storage import receipts make concurrent identical imports idempotent.
      const created=await storage.importDeck({title,description:"20 expert-level Odd One Out questions with explanations",category:"Dinner Games"},oddOneOutStarterCards,ownerId);
      res.status(201).json({id:created.id});
    } catch(err) {next(err);}
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
  registerLibraryRoutes(app);
  registerBackupRoutes(app);
  registerAuthorDraftRoutes(app);
  registerCardEditorRoutes(app);
  app.use("/api/study", requireUser);
  registerStudyRoutes(app);
  registerUniversalQuestionRoutes(app);
  registerGameReportRoutes(app);
  registerAssignmentRoutes(app);

  attachGameSocket(httpServer, storage, { checkpointStore, extraQuestions:universalGameCards, reportSink:gameReportSink, authorizeHost: async (request) => {
    const user = await resolveUser(request.headers.cookie);
    return user?.id ?? null;
  } });
  return httpServer;
}
