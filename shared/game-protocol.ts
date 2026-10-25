import { z } from "zod";
import { WS_EVENTS } from "./schema";

/** Wire protocol v1. Unknown fields and unknown client event names are rejected. */
export const PROTOCOL_VERSION = 1 as const;
export const gameModeSchema=z.enum(["classic","teams","buzzer","wager","workshop","party","odd_one_out"]);
const playerStatusSchema=z.object({coins:z.number().int().nonnegative(),focus:z.number().int().nonnegative(),guard:z.number().int().nonnegative()}).strict();
export const roomCodeSchema = z.string().regex(/^[A-HJ-NP-Z2-9]{6}$/);
const action = z.object({ roomCode: roomCodeSchema.optional() }).strict();
const letter = z.enum(["A", "B", "C", "D"]);
export const liveKindSchema = z.enum(["multiple_choice","true_false","multiple_select","ordering"]);
const responseSchema = z.union([letter, z.object({ value: z.boolean() }).strict(), z.object({ selectedIds: z.array(z.string().min(1).max(80)).min(1).max(8) }).strict(), z.object({ orderIds: z.array(z.string().min(1).max(80)).min(2).max(8) }).strict()]);
const envelope = <K extends string, T extends z.ZodTypeAny>(type: K, payload: T) =>
  z.object({ v: z.literal(PROTOCOL_VERSION), type: z.literal(type), payload }).strict();

export const clientMessageSchema = z.discriminatedUnion("type", [
  envelope(WS_EVENTS.CREATE_ROOM, z.object({ deckId: z.number().int().positive() }).strict()),
  envelope(WS_EVENTS.JOIN_ROOM, z.object({
    roomCode: roomCodeSchema, playerName: z.string().trim().min(1).max(24),
  }).strict()),
  envelope(WS_EVENTS.REJOIN_ROOM, z.object({
    roomCode: roomCodeSchema, playerId: z.string().uuid(), token: z.string().min(32).max(128),
  }).strict()),
  envelope(WS_EVENTS.RESUME_HOST, z.object({
    roomCode: roomCodeSchema, hostToken: z.string().min(32).max(128),
  }).strict()),
  envelope(WS_EVENTS.START_GAME, action),
  envelope(WS_EVENTS.NEXT_QUESTION, action),
  envelope(WS_EVENTS.CONFIGURE_GAME,z.object({roomCode:roomCodeSchema,mode:gameModeSchema,roundCount:z.number().int().min(1).max(500).optional(),timeLimitMs:z.number().int().min(5000).max(120000).optional(),shuffleQuestions:z.boolean().optional(),shuffleAnswers:z.boolean().optional()}).strict()),
  envelope(WS_EVENTS.BUZZ,z.object({roomCode:roomCodeSchema,questionIndex:z.number().int().nonnegative()}).strict()),
  envelope(WS_EVENTS.BUY_UPGRADE,z.object({roomCode:roomCodeSchema,upgrade:z.enum(["focus","guard"])}).strict()),
  envelope(WS_EVENTS.AWARD_ODD_BONUS,z.object({roomCode:roomCodeSchema,questionIndex:z.number().int().nonnegative(),playerId:z.string().uuid()}).strict()),
  envelope(WS_EVENTS.FINALIZE_ODD_REVIEW,z.object({roomCode:roomCodeSchema,questionIndex:z.number().int().nonnegative()}).strict()),
  envelope(WS_EVENTS.SUBMIT_ANSWER, z.object({
    roomCode: roomCodeSchema.optional(), questionIndex: z.number().int().nonnegative(),
    answer: responseSchema,
    explanation:z.string().trim().max(200).optional(),
    wager:z.number().int().min(0).max(100).default(0),
  }).strict()),
]);
export type ClientMessage = z.infer<typeof clientMessageSchema>;

export const roomStateSchema = z.enum(["lobby", "playing", "reveal", "leaderboard", "finished"]);
export type RoomState = z.infer<typeof roomStateSchema>;
export const publicPlayerSchema = z.object({
  playerId: z.string().uuid(), name: z.string(), score: z.number(),
  connected: z.boolean(),
  teamId:z.number().int().min(1).max(2).optional(),
}).strict();
export type PublicPlayer = z.infer<typeof publicPlayerSchema>;
export const questionSchema = z.object({
  questionIndex: z.number().int(), prompt: z.string(), choices: z.array(z.string()).min(2).max(8),
  kind: liveKindSchema.optional(), optionIds: z.array(z.string().min(1).max(80)).min(2).max(8).optional(),
  timeLimitMs: z.number().int().positive(), totalQuestions: z.number().int().min(1).max(500).optional(), serverStartTs: z.number(),
  deadlineTs: z.number(),
}).strict();
export type PublicQuestion = z.infer<typeof questionSchema>;
export const oddReviewSchema=z.object({questionIndex:z.number().int().nonnegative(),finalized:z.boolean(),entries:z.array(z.object({playerId:z.string().uuid(),name:z.string(),correct:z.boolean(),explanation:z.string(),bonusAwarded:z.boolean()}).strict())}).strict();
export type OddReview=z.infer<typeof oddReviewSchema>;
export const answerResultSchema = z.object({
  questionIndex: z.number().int(), correctLetter: letter.optional(),
  correctAnswers: z.array(z.string().max(500)).max(8).optional(),
  isCorrect: z.boolean().nullable(), awarded: z.number().int().min(-100),
  explanation:z.string().optional(), bonusAwarded:z.number().int().min(0).max(1).optional(),
}).strict();
export type AnswerResult = z.infer<typeof answerResultSchema>;
export const snapshotSchema = z.object({
  roomCode: roomCodeSchema, state: roomStateSchema, players: z.array(publicPlayerSchema),
  mode:gameModeSchema.optional(),status:playerStatusSchema.optional(),buzzedPlayerId:z.string().uuid().nullable().optional(),
  playerId: z.string().uuid().optional(), score: z.number().optional(), answered:z.boolean().optional(),
  question: questionSchema.optional(), answerResult: answerResultSchema.optional(),
  leaderboard: z.array(publicPlayerSchema).optional(), oddReview:oddReviewSchema.optional(),
}).strict();

export const serverMessageSchema = z.discriminatedUnion("type", [
  envelope(WS_EVENTS.ROOM_CREATED, z.object({ roomCode: roomCodeSchema, hostToken: z.string() }).strict()),
  envelope(WS_EVENTS.HOST_RESUMED, z.object({ roomCode: roomCodeSchema, hostToken: z.string() }).strict()),
  envelope(WS_EVENTS.ROOM_JOINED, z.object({
    roomCode: roomCodeSchema, playerId: z.string().uuid(), token: z.string(),
  }).strict()),
  envelope(WS_EVENTS.LOBBY_UPDATE, z.object({ players: z.array(publicPlayerSchema) }).strict()),
  envelope(WS_EVENTS.GAME_STARTED, z.object({}).strict()),
  envelope(WS_EVENTS.GAME_CONFIGURED,z.object({mode:gameModeSchema}).strict()),
  envelope(WS_EVENTS.BUZZ_STATE,z.object({playerId:z.string().uuid().nullable()}).strict()),
  envelope(WS_EVENTS.PLAYER_STATUS,playerStatusSchema),
  envelope(WS_EVENTS.ANSWER_ACCEPTED,z.object({questionIndex:z.number().int().nonnegative()}).strict()),
  envelope(WS_EVENTS.QUESTION_START, questionSchema),
  envelope(WS_EVENTS.ANSWER_RESULT, answerResultSchema),
  envelope(WS_EVENTS.ODD_REVIEW_STATE,oddReviewSchema),
  envelope(WS_EVENTS.LEADERBOARD, z.object({ leaderboard: z.array(publicPlayerSchema) }).strict()),
  envelope(WS_EVENTS.GAME_OVER, z.object({ leaderboard: z.array(publicPlayerSchema) }).strict()),
  envelope(WS_EVENTS.ERROR, z.object({ message: z.string() }).strict()),
  envelope(WS_EVENTS.SYNC_SNAPSHOT, snapshotSchema),
]);
export type ServerMessage = z.infer<typeof serverMessageSchema>;
