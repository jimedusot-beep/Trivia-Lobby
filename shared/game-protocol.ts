import { z } from "zod";
import { WS_EVENTS } from "./schema";

/** Wire protocol v1. Unknown fields and unknown client event names are rejected. */
export const PROTOCOL_VERSION = 1 as const;
export const roomCodeSchema = z.string().regex(/^[A-HJ-NP-Z2-9]{6}$/);
const action = z.object({ roomCode: roomCodeSchema.optional() }).strict();
const envelope = <T extends z.ZodTypeAny>(type: string, payload: T) =>
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
  envelope(WS_EVENTS.SUBMIT_ANSWER, z.object({
    roomCode: roomCodeSchema.optional(), questionIndex: z.number().int().nonnegative(),
    answer: z.enum(["A", "B", "C", "D"]),
  }).strict()),
]);
export type ClientMessage = z.infer<typeof clientMessageSchema>;

export const roomStateSchema = z.enum(["lobby", "playing", "reveal", "leaderboard", "finished"]);
export type RoomState = z.infer<typeof roomStateSchema>;
export const publicPlayerSchema = z.object({
  playerId: z.string().uuid(), name: z.string(), score: z.number(),
  connected: z.boolean(),
}).strict();
export type PublicPlayer = z.infer<typeof publicPlayerSchema>;
export const questionSchema = z.object({
  questionIndex: z.number().int(), prompt: z.string(), choices: z.array(z.string()).length(4),
  timeLimitMs: z.number().int().positive(), serverStartTs: z.number(),
  deadlineTs: z.number(),
}).strict();
export type PublicQuestion = z.infer<typeof questionSchema>;
export const answerResultSchema = z.object({
  questionIndex: z.number().int(), correctLetter: z.enum(["A", "B", "C", "D"]),
  isCorrect: z.boolean().nullable(), awarded: z.number().int().nonnegative(),
}).strict();
export type AnswerResult = z.infer<typeof answerResultSchema>;
export const snapshotSchema = z.object({
  roomCode: roomCodeSchema, state: roomStateSchema, players: z.array(publicPlayerSchema),
  playerId: z.string().uuid().optional(), score: z.number().optional(),
  question: questionSchema.optional(), answerResult: answerResultSchema.optional(),
  leaderboard: z.array(publicPlayerSchema).optional(),
}).strict();

export const serverMessageSchema = z.discriminatedUnion("type", [
  envelope(WS_EVENTS.ROOM_CREATED, z.object({ roomCode: roomCodeSchema, hostToken: z.string() }).strict()),
  envelope(WS_EVENTS.HOST_RESUMED, z.object({ roomCode: roomCodeSchema, hostToken: z.string() }).strict()),
  envelope(WS_EVENTS.ROOM_JOINED, z.object({
    roomCode: roomCodeSchema, playerId: z.string().uuid(), token: z.string(),
  }).strict()),
  envelope(WS_EVENTS.LOBBY_UPDATE, z.object({ players: z.array(publicPlayerSchema) }).strict()),
  envelope(WS_EVENTS.GAME_STARTED, z.object({}).strict()),
  envelope(WS_EVENTS.QUESTION_START, questionSchema),
  envelope(WS_EVENTS.ANSWER_RESULT, answerResultSchema),
  envelope(WS_EVENTS.LEADERBOARD, z.object({ leaderboard: z.array(publicPlayerSchema) }).strict()),
  envelope(WS_EVENTS.GAME_OVER, z.object({ leaderboard: z.array(publicPlayerSchema) }).strict()),
  envelope(WS_EVENTS.ERROR, z.object({ message: z.string() }).strict()),
  envelope(WS_EVENTS.SYNC_SNAPSHOT, snapshotSchema),
]);
export type ServerMessage = z.infer<typeof serverMessageSchema>;
