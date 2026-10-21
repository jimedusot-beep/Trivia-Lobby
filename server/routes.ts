import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { attachGameSocket } from "./live-game";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // === HTTP API ROUTES ===

  app.get(api.decks.list.path, async (req, res) => {
    const decks = await storage.getDecks();
    res.json(decks);
  });

  app.get(api.decks.get.path, async (req, res) => {
    const deck = await storage.getDeck(Number(req.params.id));
    if (!deck) return res.status(404).json({ message: "Deck not found" });
    res.json(deck);
  });

  app.post(api.decks.create.path, async (req, res) => {
    try {
      const input = api.decks.create.input.parse(req.body);
      const deck = await storage.createDeck(input);
      res.status(201).json(deck);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.message });
      }
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.post(api.decks.import.path, async (req, res) => {
    try {
      const input = api.decks.import.input.parse(req.body);
      const deck = await storage.importDeck(input.deck, input.cards);
      res.status(201).json(deck);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.message });
      }
      console.error("Deck import failed:", err);
      res.status(500).json({ message: "Import failed; no partial deck was saved." });
    }
  });

  app.post(api.cards.create.path, async (req, res) => {
    try {
      const deckId = Number(req.params.id);
      const input = api.cards.create.input.parse(req.body);
      const cards = await storage.createCards(deckId, input);
      res.status(201).json(cards);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.message });
      }
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.delete(api.decks.delete.path, async (req, res) => {
    await storage.deleteDeck(Number(req.params.id));
    res.status(204).send();
  });


  attachGameSocket(httpServer, storage);

  // Seed if empty
  await seedDatabase();

  return httpServer;
}

// Seed function
export async function seedDatabase() {
  const existing = await storage.getDecks();
  if (existing.length === 0) {
    const deck = await storage.createDeck({
      title: "General Knowledge",
      description: "A sample trivia deck",
      category: "Trivia"
    });
    
    await storage.createCards(deck.id, [
      {
        front: "What is the capital of France?",
        back: "Paris",
        type: "multiple_choice",
        options: ["London", "Berlin", "Madrid", "Paris"],
        correctOption: "D"
      },
      {
        front: "Which planet is known as the Red Planet?",
        back: "Mars",
        type: "multiple_choice",
        options: ["Venus", "Mars", "Jupiter", "Saturn"],
        correctOption: "B"
      }
    ]);
  }
}
