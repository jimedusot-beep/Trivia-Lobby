import { randomBytes, randomUUID, createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export const ROOM_CODE_LENGTH = 8;
export const QUESTION_TIME_MS = 30_000;
export const MAX_PLAYERS = 100;
export const MAX_ROOMS = 1000;
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateRoomCode(used: ReadonlySet<string>): string {
  for (let attempt = 0; attempt < 20; attempt++) {
    const bytes = randomBytes(ROOM_CODE_LENGTH);
    const code = Array.from(bytes, byte => alphabet[byte & 31]).join("");
    if (!used.has(code)) return code;
  }
  throw new Error("Room code allocation failed");
}

export function newPlayerCredentials() {
  return { playerId: randomUUID(), reconnectToken: randomBytes(32).toString("base64url") };
}
export function hashToken(token: string): Buffer {
  return createHash("sha256").update(token).digest();
}
export function isValidToken(token: string, expectedHash: Buffer): boolean {
  const actual = hashToken(token);
  return actual.length === expectedHash.length && timingSafeEqual(actual, expectedHash);
}

const roomCode = z.string().regex(/^[A-HJ-NP-Z2-9]{8}$/);
const empty = z.object({ roomCode }).strict();
export const incomingMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("create_room"), payload: z.object({ deckId: z.number().int().positive(), hostToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }).strict() }).strict(),
  z.object({ type: z.literal("join_room"), payload: z.object({
    roomCode, playerName: z.string().trim().min(1).max(24)
  }).strict() }).strict(),
  z.object({ type: z.literal("rejoin_room"), payload: z.object({
    roomCode, playerId: z.string().uuid(), reconnectToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/)
  }).strict() }).strict(),
  z.object({ type: z.literal("start_game"), payload: empty }).strict(),
  z.object({ type: z.literal("next_question"), payload: empty }).strict(),
  z.object({ type: z.literal("submit_answer"), payload: z.object({
    roomCode, questionId: z.number().int().nonnegative(), answer: z.enum(["A", "B", "C", "D"])
  }).strict() }).strict()
]);
export type IncomingGameMessage = z.infer<typeof incomingMessageSchema>;

export function scoreAnswer(answer: string, correctOption: string, streak: number) {
  const correct = answer === correctOption;
  return { correct, points: correct ? 100 + streak * 10 : 0, streak: correct ? streak + 1 : 0 };
}

export function safeLeaderboard(players: Iterable<{
  id: string; name: string; score: number; lastPoints: number; connected: boolean;
}>) {
  return Array.from(players, player => ({
    playerId: player.id, name: player.name, score: player.score,
    lastPoints: player.lastPoints, connected: player.connected
  })).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

type Window = { count: number; expires: number };
const ipWindows = new Map<string, Window>();
export function allowRate(key: string, max: number, periodMs: number, now = Date.now()): boolean {
  if (ipWindows.size > 10_000) {
    for (const [k, v] of ipWindows) if (v.expires <= now) ipWindows.delete(k);
  }
  const old = ipWindows.get(key);
  if (!old || old.expires <= now) {
    ipWindows.set(key, { count: 1, expires: now + periodMs });
    return true;
  }
  if (old.count >= max) return false;
  old.count += 1;
  return true;
}
