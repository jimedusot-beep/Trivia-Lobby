import { pgTable, text, serial, integer, timestamp, jsonb, uuid, index, uniqueIndex, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Phase 3: keep legacy decks with NULL owner unclaimed and inaccessible.
// Operators must verify ownership before assigning any pre-account data.
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userSessions = pgTable("user_sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("user_sessions_user_idx").on(table.userId), index("user_sessions_expiry_idx").on(table.expiresAt)]);

export const decks = pgTable("decks", {
  id: serial("id").primaryKey(),
  ownerId: uuid("owner_id").references(() => users.id, { onDelete: "restrict" }),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").default("General"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("decks_owner_idx").on(table.ownerId)]);

export const cards = pgTable("cards", {
  id: serial("id").primaryKey(),
  deckId: integer("deck_id").notNull().references(() => decks.id, { onDelete: "cascade" }),
  type: text("type").notNull().default("flashcard"),
  front: text("front").notNull(),
  back: text("back").notNull(),
  options: jsonb("options"),
  correctOption: text("correct_option"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("cards_deck_idx").on(table.deckId)]);

export const libraryFiles = pgTable("library_files", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  sha256: text("sha256").notNull(),
  objectKey: text("object_key").notNull().unique(),
  importStatus: text("import_status").notNull().default("uploaded"),
  folder: text("folder").notNull().default("Unfiled"),
  tags: text("tags").array().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("library_files_owner_hash_idx").on(table.ownerId, table.sha256),
  index("library_files_owner_date_idx").on(table.ownerId, table.createdAt),
]);

export const deckSources = pgTable("deck_sources", {
  deckId: integer("deck_id").notNull().references(() => decks.id, { onDelete: "cascade" }),
  fileId: uuid("file_id").notNull().references(() => libraryFiles.id, { onDelete: "cascade" }),
}, (table) => [primaryKey({ columns: [table.deckId, table.fileId] })]);

export const decksRelations = relations(decks, ({ many }) => ({ cards: many(cards) }));
export const cardsRelations = relations(cards, ({ one }) => ({
  deck: one(decks, { fields: [cards.deckId], references: [decks.id] }),
}));

// Clients cannot select or change ownership.
export const insertDeckSchema = createInsertSchema(decks).omit({ id: true, ownerId: true, createdAt: true });
export const insertCardSchema = createInsertSchema(cards).omit({ id: true, createdAt: true });

export type Deck = typeof decks.$inferSelect;
export type InsertDeck = z.infer<typeof insertDeckSchema>;
export type Card = typeof cards.$inferSelect;
export type InsertCard = z.infer<typeof insertCardSchema>;
export type CreateDeckRequest = InsertDeck;
export type CreateCardRequest = InsertCard;
export type BulkCreateCardRequest = InsertCard[];
export type DeckWithCards = Deck & { cards: Card[] };

export const WS_EVENTS = {
  CREATE_ROOM: 'create_room', JOIN_ROOM: 'join_room', START_GAME: 'start_game',
  SUBMIT_ANSWER: 'submit_answer', NEXT_QUESTION: 'next_question',
  REJOIN_ROOM: 'rejoin_room', ROOM_CREATED: 'room_created',
  LOBBY_UPDATE: 'lobby_update', GAME_STARTED: 'game_started',
  QUESTION_START: 'question_start', ANSWER_RESULT: 'answer_result',
  GAME_OVER: 'game_over', ERROR: 'error', SYNC_SNAPSHOT: 'sync_snapshot',
} as const;

export interface CreateRoomPayload { deckId: number }
export interface JoinRoomPayload { roomCode: string; playerName: string; playerId?: string }
export interface SubmitAnswerPayload { roomCode: string; answer: string }
