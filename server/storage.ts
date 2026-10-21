import { db } from "./db";
import {
  decks,
  cards,
  type InsertDeck,
  type InsertCard,
  type Deck,
  type Card
} from "@shared/schema";
import { and, eq } from "drizzle-orm";

export interface IStorage {
  // Decks
  getDecks(ownerId: string): Promise<Deck[]>;
  getDeck(id: number, ownerId: string): Promise<(Deck & { cards: Card[] }) | undefined>;
  createDeck(deck: InsertDeck, ownerId: string): Promise<Deck>;
  importDeck(deck: InsertDeck, cardsList: Omit<InsertCard, 'deckId'>[], ownerId: string): Promise<Deck>;
  deleteDeck(id: number, ownerId: string): Promise<boolean>;
  
  // Cards
  createCards(deckId: number, cardsList: Omit<InsertCard, 'deckId'>[], ownerId: string): Promise<Card[]>;
}

export class DatabaseStorage implements IStorage {
  async getDecks(ownerId: string): Promise<Deck[]> {
    return await db.select().from(decks).where(eq(decks.ownerId, ownerId)).orderBy(decks.createdAt);
  }

  async getDeck(id: number, ownerId: string): Promise<(Deck & { cards: Card[] }) | undefined> {
    const deck = await db.select().from(decks).where(and(eq(decks.id, id), eq(decks.ownerId, ownerId)));
    if (deck.length === 0) return undefined;

    const deckCards = await db.select().from(cards).where(eq(cards.deckId, id));
    
    return { ...deck[0], cards: deckCards };
  }

  async createDeck(deck: InsertDeck, ownerId: string): Promise<Deck> {
    const [newDeck] = await db.insert(decks).values({ ...deck, ownerId }).returning();
    return newDeck;
  }

  // Save deck and every card in a single transaction. Roll back on any failure.
  async importDeck(deck: InsertDeck, cardsList: Omit<InsertCard, 'deckId'>[], ownerId: string): Promise<Deck> {
    if (cardsList.length === 0) throw new Error('Cannot import an empty deck');
    return db.transaction(async (tx) => {
      const [created] = await tx.insert(decks).values({ ...deck, ownerId }).returning();
      await tx.insert(cards).values(cardsList.map(card => ({ ...card, deckId: created.id })));
      return created;
    });
  }

  async deleteDeck(id: number, ownerId: string): Promise<boolean> {
    return db.transaction(async (tx) => {
      // The database FK cascades card deletions atomically with the deck.
      const deleted = await tx.delete(decks).where(and(eq(decks.id, id), eq(decks.ownerId, ownerId))).returning({ id: decks.id });
      return deleted.length > 0;
    });
  }

  async createCards(deckId: number, cardsList: Omit<InsertCard, 'deckId'>[], ownerId: string): Promise<Card[]> {
    if (cardsList.length === 0) return [];
    return db.transaction(async (tx) => {
      const [owned] = await tx.select({ id: decks.id }).from(decks)
        .where(and(eq(decks.id, deckId), eq(decks.ownerId, ownerId)));
      if (!owned) throw new Error("Deck not found");
      return tx.insert(cards).values(cardsList.map(c => ({ ...c, deckId }))).returning();
    });
  }
}

export const storage = new DatabaseStorage();
