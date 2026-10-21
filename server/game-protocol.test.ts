import test from "node:test";
import assert from "node:assert/strict";
import {
  generateRoomCode, hashToken, incomingMessageSchema, isValidToken,
  newPlayerCredentials, allowRate, safeLeaderboard, scoreAnswer
} from "./game-protocol";

test("room codes use an eight-character nonambiguous alphabet and do not overwrite existing rooms", () => {
  const codes = new Set<string>();
  for (let i = 0; i < 1000; i++) {
    const next = generateRoomCode(codes);
    assert.match(next, /^[A-HJ-NP-Z2-9]{8}$/);
    assert.equal(codes.has(next), false);
    codes.add(next);
  }
});

test("player reconnect credentials are random, secret and must match", () => {
  const first = newPlayerCredentials();
  const second = newPlayerCredentials();
  assert.notEqual(first.playerId, second.playerId);
  assert.notEqual(first.reconnectToken, second.reconnectToken);
  assert.equal(first.reconnectToken.length, 43);
  assert.equal(isValidToken(first.reconnectToken, hashToken(first.reconnectToken)), true);
  assert.equal(isValidToken(second.reconnectToken, hashToken(first.reconnectToken)), false);
});

test("incoming schemas reject unexpected and unsafe socket messages", () => {
  const valid = {
    type: "join_room",
    payload: { roomCode: "ABCDEFGH", playerName: "Alex" }
  };
  assert.equal(incomingMessageSchema.safeParse(valid).success, true);
  assert.equal(incomingMessageSchema.safeParse({
    ...valid, payload: { ...valid.payload, playerId: "forged" }
  }).success, false);
  assert.equal(incomingMessageSchema.safeParse({
    type: "submit_answer",
    payload: { roomCode: "ABCDEFGH", questionId: 0, answer: "E" }
  }).success, false);
  assert.equal(incomingMessageSchema.safeParse({
    type: "start_game", payload: { roomCode: "ABCDEFGH", admin: true }
  }).success, false);
  assert.equal(incomingMessageSchema.safeParse({
    type: "create_room", payload: { deckId: -1 }
  }).success, false);
  assert.equal(incomingMessageSchema.safeParse({
    type: "rejoin_room", payload: { roomCode: "ABCDEFGH", playerId: "123", reconnectToken: "123" }
  }).success, false);
});

test("answer scoring is server authoritative and streak-based", () => {
  assert.deepEqual(scoreAnswer("B", "B", 2), { correct: true, points: 120, streak: 3 });
  assert.deepEqual(scoreAnswer("C", "B", 2), { correct: false, points: 0, streak: 0 });
});

test("leaderboard only serializes safe public fields", () => {
  const results = safeLeaderboard([
    { id: "a", name: "One", score: 25, lastPoints: 25, connected: true, tokenHash: "private", ws: "private" },
    { id: "b", name: "Two", score: 100, lastPoints: 100, connected: false, tokenHash: "private" }
  ]);
  assert.equal(results[0].playerId, "b");
  assert.equal(JSON.stringify(results).includes("tokenHash"), false);
  assert.equal(JSON.stringify(results).includes("ws"), false);
});

test("rate limiter enforces window capacity then resets after expiry", () => {
  const key = "test-" + newPlayerCredentials().playerId;
  assert.equal(allowRate(key, 2, 60_000, 100), true);
  assert.equal(allowRate(key, 2, 60_000, 100), true);
  assert.equal(allowRate(key, 2, 60_000, 100), false);
  assert.equal(allowRate(key, 2, 60_000, 60_101), true);
});
