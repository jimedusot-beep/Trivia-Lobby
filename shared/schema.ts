import { pgTable, text, serial, integer, bigint, boolean, timestamp, jsonb, uuid, index, uniqueIndex, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Server-private recovery records. The startup SQL migration also installs atomic budget/fencing logic.
export const liveRoomCheckpoints = pgTable("live_room_checkpoints", {
  kind: text("kind").notNull(), code: text("code").notNull(), version: bigint("version", { mode: "number" }).notNull(),
  state: jsonb("state").notNull(), payloadBytes: integer("payload_bytes").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [primaryKey({ columns: [table.kind, table.code] }), index("live_room_checkpoints_expiry").on(table.expiresAt)]);

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
  position:integer("position").notNull().default(0),
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
  course: text("course").notNull().default(""),
  extractedText: text("extracted_text").notNull().default(""),
  extractionStatus: text("extraction_status").notNull().default("pending"),
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
export const insertDeckSchema = createInsertSchema(decks).omit({ id: true, ownerId: true, createdAt: true }).extend({
  title: z.string().trim().min(1).max(200), description: z.string().max(4000).nullable().optional(), category: z.string().trim().min(1).max(100).nullable().optional(),
});
export const insertCardSchema = createInsertSchema(cards).omit({ id: true, position:true, createdAt: true }).extend({
  type: z.enum(["flashcard", "multiple_choice"]).default("flashcard"),
  front: z.string().trim().min(1).max(10000), back: z.string().trim().min(1).max(10000),
  options: z.array(z.string().trim().min(1).max(1000)).max(4).nullable().optional(),
  correctOption: z.string().regex(/^[A-D]$/).nullable().optional(),
});

export type Deck = typeof decks.$inferSelect;
export type InsertDeck = z.infer<typeof insertDeckSchema>;
export type Card = typeof cards.$inferSelect;
export type InsertCard = z.infer<typeof insertCardSchema>;
export type CreateDeckRequest = InsertDeck;
export type CreateCardRequest = InsertCard;
export type BulkCreateCardRequest = InsertCard[];
export type DeckWithCards = Deck & { cards: Card[] };

export const WS_EVENTS = {
  // Client -> Server
  CREATE_ROOM: 'create_room',
  JOIN_ROOM: 'join_room',
  START_GAME: 'start_game',
  SUBMIT_ANSWER: 'submit_answer',
  NEXT_QUESTION: 'next_question',
  REJOIN_ROOM: 'rejoin_room',
  RESUME_HOST: 'resume_host',
  
  // Server -> Client
  ROOM_CREATED: 'room_created',
  ROOM_JOINED: 'room_joined',
  HOST_RESUMED: 'host_resumed',
  LEADERBOARD: 'leaderboard',
  LOBBY_UPDATE: 'lobby_update',
  GAME_STARTED: 'game_started',
  QUESTION_START: 'question_start',
  SUBMISSION_PROGRESS: 'submission_progress', // Aggregate, host-only
  ANSWER_RESULT: 'answer_result',
  GAME_OVER: 'game_over',
  ERROR: 'error',
  SYNC_SNAPSHOT: 'sync_snapshot', // Added for reliability
  CONFIGURE_GAME:'configure_game', GAME_CONFIGURED:'game_configured',
  BUZZ:'buzz', BUZZ_STATE:'buzz_state', BUY_UPGRADE:'buy_upgrade', PLAYER_STATUS:'player_status', ANSWER_ACCEPTED:'answer_accepted', ACTION_ACK:'action_ack', CONFIRM_SESSION:'confirm_session',
  ODD_REVIEW_STATE:'odd_review_state', AWARD_ODD_BONUS:'award_odd_bonus', FINALIZE_ODD_REVIEW:'finalize_odd_review',
} as const;

// Define payload types for better type safety in socket handlers
export interface CreateRoomPayload {
  deckId: number;
}

export interface JoinRoomPayload {
  roomCode: string;
  playerName: string;
  playerId?: string; // Deprecated legacy interface; wire v1 uses separate credential-backed rejoin
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

// Persistent review memory uses the same account as the private library.
export const studySchedule = pgTable("study_schedule", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
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
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  // The live reference becomes null if material is deleted; immutable snapshots survive.
  cardId: integer("card_id").references(() => cards.id, { onDelete: "set null" }),
  originalCardId: integer("original_card_id"),
  originalDeckId: integer("original_deck_id"),
  frontSnapshot: text("front_snapshot"),
  deckTitleSnapshot: text("deck_title_snapshot"),
  subjectSnapshot: text("subject_snapshot"),
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
  fileId: uuid("file_id").references(() => libraryFiles.id, { onDelete: "set null" }),
  id: uuid("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const studyDrafts = pgTable("study_drafts", {
  publishedQuestionId: integer("published_question_id").references(() => universalQuestions.id, { onDelete: "set null" }),
  id: uuid("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  sourceId: uuid("source_id").notNull().references(() => studySources.id, { onDelete: "cascade" }),
  front: text("front").notNull(),
  back: text("back").notNull(),
  explanation: text("explanation"),
  evidence: text("evidence").notNull(),
  approved: boolean("approved").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("study_drafts_user_source_idx").on(table.userId, table.sourceId)]);
