import { db } from "./db";
import {
  decks,
  cards,
  type InsertDeck,
  type InsertCard,
  type Deck,
  type Card
} from "@shared/schema";
import { eq } from "drizzle-orm";

export interface IStorage {
  // Decks
  getDecks(): Promise<Deck[]>;
  getDeck(id: number): Promise<(Deck & { cards: Card[] }) | undefined>;
  createDeck(deck: InsertDeck): Promise<Deck>;
  deleteDeck(id: number): Promise<void>;
  
  // Cards
  createCards(deckId: number, cardsList: InsertCard[]): Promise<Card[]>;
}

export class DatabaseStorage implements IStorage {
  async getDecks(): Promise<Deck[]> {
    return await db.select().from(decks).orderBy(decks.createdAt);
  }

  async getDeck(id: number): Promise<(Deck & { cards: Card[] }) | undefined> {
    const deck = await db.select().from(decks).where(eq(decks.id, id));
    if (deck.length === 0) return undefined;

    const deckCards = await db.select().from(cards).where(eq(cards.deckId, id));
    
    return { ...deck[0], cards: deckCards };
  }

  async createDeck(deck: InsertDeck): Promise<Deck> {
    const [newDeck] = await db.insert(decks).values(deck).returning();
    return newDeck;
  }

  async deleteDeck(id: number): Promise<void> {
    await db.delete(cards).where(eq(cards.deckId, id));
    await db.delete(decks).where(eq(decks.id, id));
  }

  async createCards(deckId: number, cardsList: InsertCard[]): Promise<Card[]> {
    if (cardsList.length === 0) return [];
    
    const cardsWithDeckId = cardsList.map(c => ({ ...c, deckId }));
    return await db.insert(cards).values(cardsWithDeckId).returning();
  }
}

export const storage = new DatabaseStorage();
