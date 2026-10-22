import { pgTable, text, serial, integer, boolean, timestamp, jsonb, uuid, primaryKey, uniqueIndex, index } from "drizzle-orm/pg-core";
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

// === PHASE 4: PRIVATE STUDY DATA ===
// Decks remain public in the current MVP. Review state and sources never do.
export const studyAccounts = pgTable("study_accounts", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const studyAuthTokens = pgTable("study_auth_tokens", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => studyAccounts.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const studySchedule = pgTable("study_schedule", {
  userId: uuid("user_id").notNull().references(() => studyAccounts.id, { onDelete: "cascade" }),
  cardId: integer("card_id").notNull().references(() => cards.id, { onDelete: "cascade" }),
  fsrsState: jsonb("fsrs_state").notNull(),
  dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
  lastRating: integer("last_rating").notNull(),
  needsWork: boolean("needs_work").notNull().default(false),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [primaryKey({ columns: [table.userId, table.cardId] }), index("study_schedule_user_due_idx").on(table.userId, table.dueAt)]);

export const studyEvents = pgTable("study_events", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => studyAccounts.id, { onDelete: "cascade" }),
  cardId: integer("card_id").notNull().references(() => cards.id, { onDelete: "cascade" }),
  requestId: uuid("request_id").notNull(),
  rating: integer("rating").notNull(),
  correct: boolean("correct").notNull(),
  dueBefore: timestamp("due_before", { withTimezone: true }),
  dueAfter: timestamp("due_after", { withTimezone: true }).notNull(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }).notNull().defaultNow(),
  stateBefore: jsonb("state_before").notNull(),
  stateAfter: jsonb("state_after").notNull(),
}, (table) => [uniqueIndex("study_events_user_request_idx").on(table.userId, table.requestId), index("study_events_user_time_idx").on(table.userId, table.reviewedAt)]);

export const studySources = pgTable("study_sources", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => studyAccounts.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const studyDrafts = pgTable("study_drafts", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => studyAccounts.id, { onDelete: "cascade" }),
  sourceId: uuid("source_id").notNull().references(() => studySources.id, { onDelete: "cascade" }),
  front: text("front").notNull(),
  back: text("back").notNull(),
  explanation: text("explanation"),
  evidence: text("evidence").notNull(),
  approved: boolean("approved").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("study_drafts_user_source_idx").on(table.userId, table.sourceId)]);
