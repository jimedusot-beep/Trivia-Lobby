import { pgTable, text, serial, integer, boolean, timestamp, jsonb, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// === TABLE DEFINITIONS ===

export const decks = pgTable("decks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").default("General"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const cards = pgTable("cards", {
  id: serial("id").primaryKey(),
  deckId: integer("deck_id").notNull(), // Foreign key ref added in relations
  type: text("type").notNull().default("flashcard"), // 'flashcard' or 'multiple_choice'
  front: text("front").notNull(), // Question or Front of card
  back: text("back").notNull(),   // Answer or Back of card
  options: jsonb("options"),      // For trivia: ["A", "B", "C", "D"]
  correctOption: text("correct_option"), // For trivia: "A"
  createdAt: timestamp("created_at").defaultNow(),
});

// === RELATIONS ===

export const decksRelations = relations(decks, ({ many }) => ({
  cards: many(cards),
}));

export const cardsRelations = relations(cards, ({ one }) => ({
  deck: one(decks, {
    fields: [cards.deckId],
    references: [decks.id],
  }),
}));

// === BASE SCHEMAS ===

export const insertDeckSchema = createInsertSchema(decks).omit({ id: true, createdAt: true });
export const insertCardSchema = createInsertSchema(cards).omit({ id: true, createdAt: true });

// === EXPLICIT API CONTRACT TYPES ===

// Base types
export type Deck = typeof decks.$inferSelect;
export type InsertDeck = z.infer<typeof insertDeckSchema>;
export type Card = typeof cards.$inferSelect;
export type InsertCard = z.infer<typeof insertCardSchema>;

// Request types
export type CreateDeckRequest = InsertDeck;
export type CreateCardRequest = InsertCard;
export type BulkCreateCardRequest = InsertCard[];

// Response types
export type DeckWithCards = Deck & { cards: Card[] };

// WebSocket Messages
export const WS_EVENTS = {
  // Client -> Server
  CREATE_ROOM: 'create_room',
  JOIN_ROOM: 'join_room',
  START_GAME: 'start_game',
  SUBMIT_ANSWER: 'submit_answer',
  NEXT_QUESTION: 'next_question',
  REJOIN_ROOM: 'rejoin_room', // Added for reliability
  
  // Server -> Client
  ROOM_CREATED: 'room_created',
  LOBBY_UPDATE: 'lobby_update',
  GAME_STARTED: 'game_started',
  QUESTION_START: 'question_start',
  ANSWER_RESULT: 'answer_result',
  GAME_OVER: 'game_over',
  ERROR: 'error',
  SYNC_SNAPSHOT: 'sync_snapshot', // Added for reliability
} as const;

// Define payload types for better type safety in socket handlers
export interface CreateRoomPayload {
  deckId: number;
}

export interface JoinRoomPayload {
  roomCode: string;
  playerName: string;
  playerId?: string; // Optional for reconnects, but strictly client generates this usually or server assigns
}

export interface SubmitAnswerPayload {
  roomCode: string;
  answer: string;
}

// ... other payloads can be inferred from context, but these help shared understanding


// Phase 2: additive question definitions. Legacy cards remain unchanged.
// JSON is parsed against the versioned shared schema at the API boundary.
export const universalQuestions = pgTable("universal_questions", {
  id: serial("id").primaryKey(),
  deckId: integer("deck_id").notNull().references(() => decks.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  fingerprint: text("fingerprint").notNull(),
  definition: jsonb("definition").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, table => [
  uniqueIndex("uq_universal_question_deck_fingerprint").on(table.deckId, table.fingerprint),
  index("idx_universal_question_deck_position").on(table.deckId, table.position),
]);
