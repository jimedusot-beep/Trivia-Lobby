import { db } from "./db";
import { decks, cards, libraryFiles, deckSources, type InsertDeck, type InsertCard, type Deck, type Card } from "@shared/schema";
import { and, eq, sql } from "drizzle-orm";
import { createHash } from "node:crypto";

export interface IStorage {
  getDecks(ownerId: string): Promise<Deck[]>;
  getDeck(id: number, ownerId: string): Promise<(Deck & { cards: Card[] }) | undefined>;
  createDeck(deck: InsertDeck, ownerId: string): Promise<Deck>;
  importDeck(deck: InsertDeck, cardsList: Omit<InsertCard, "deckId">[], ownerId: string, sourceFileId?: string): Promise<Deck>;
  deleteDeck(id: number, ownerId: string): Promise<boolean>;
  createCards(deckId: number, cardsList: Omit<InsertCard, "deckId">[], ownerId: string): Promise<Card[]>;
}

export class DatabaseStorage implements IStorage {
  async getDecks(ownerId: string): Promise<Deck[]> {
    return db.select().from(decks).where(eq(decks.ownerId, ownerId)).orderBy(decks.createdAt);
  }
  async getDeck(id: number, ownerId: string): Promise<(Deck & { cards: Card[] }) | undefined> {
    const [deck] = await db.select().from(decks).where(and(eq(decks.id, id), eq(decks.ownerId, ownerId))).limit(1);
    if (!deck) return undefined;
    const deckCards = await db.select().from(cards).where(eq(cards.deckId, id));
    return { ...deck, cards: deckCards };
  }
  async createDeck(deck: InsertDeck, ownerId: string): Promise<Deck> {
    const [created] = await db.insert(decks).values({ ...deck, ownerId }).returning();
    return created;
  }
  async importDeck(deck: InsertDeck, cardsList: Omit<InsertCard, "deckId">[], ownerId: string, sourceFileId?: string): Promise<Deck> {
    if (cardsList.length === 0 || cardsList.length > 5000) throw new Error("Import requires 1–5000 cards");
    return db.transaction(async tx => {
      const fingerprint = createHash("sha256").update(JSON.stringify({deck,cardsList,sourceFileId:sourceFileId??null})).digest("hex");
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${ownerId}),hashtext(${fingerprint}))`);
      const receipt=await tx.execute(sql`SELECT deck_id FROM import_receipts WHERE owner_id=${ownerId} AND fingerprint=${fingerprint}`);
      if(receipt.rows[0]) {
        const [previous]=await tx.select().from(decks).where(and(eq(decks.id,Number(receipt.rows[0].deck_id)),eq(decks.ownerId,ownerId)));
        if(previous)return previous;
      }
      if (sourceFileId) {
        const [source] = await tx.select({ id: libraryFiles.id }).from(libraryFiles)
          .where(and(eq(libraryFiles.id, sourceFileId), eq(libraryFiles.ownerId, ownerId))).limit(1);
        if (!source) throw new Error("Source file not found");
      }
      const [created] = await tx.insert(decks).values({ ...deck, ownerId }).returning();
      await tx.insert(cards).values(cardsList.map(card => ({ ...card, deckId: created.id })));
      if (sourceFileId) {
        await tx.insert(deckSources).values({ deckId: created.id, fileId: sourceFileId });
        await tx.update(libraryFiles).set({ importStatus: "linked" }).where(and(eq(libraryFiles.id, sourceFileId), eq(libraryFiles.ownerId, ownerId)));
      }
      await tx.execute(sql`INSERT INTO import_receipts(owner_id,fingerprint,deck_id) VALUES(${ownerId},${fingerprint},${created.id})`);
      return created;
    });
  }
  async deleteDeck(id: number, ownerId: string): Promise<boolean> {
    const deleted = await db.delete(decks).where(and(eq(decks.id, id), eq(decks.ownerId, ownerId))).returning({ id: decks.id });
    return deleted.length !== 0;
  }
  async createCards(deckId: number, cardsList: Omit<InsertCard, "deckId">[], ownerId: string): Promise<Card[]> {
    if (cardsList.length === 0) return [];
    return db.transaction(async tx => {
      const [deck] = await tx.select({ id: decks.id }).from(decks).where(and(eq(decks.id, deckId), eq(decks.ownerId, ownerId))).limit(1);
      if (!deck) throw new Error("Deck not found");
      return tx.insert(cards).values(cardsList.map(c => ({ ...c, deckId }))).returning();
    });
  }
}
export const storage = new DatabaseStorage();
