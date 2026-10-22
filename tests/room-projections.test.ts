import assert from "node:assert/strict";
import test from "node:test";
import { canSubmitAnswer, publicLeaderboard, publicPlayerView } from "../server/room-projections";

test("TL-REA-001: leaderboard excludes transport internals and resolves ties deterministically", () => {
 const a = { id: "b", name: "Player B", score: 100, connected: true, ws: { secret: "never expose" }, streak: 5 };
 const b = { id: "a", name: "Player A", score: 100, connected: false, ws: { secret: "never expose" }, streak: 7 };
 assert.deepEqual(publicLeaderboard([a, b]), [
  { playerId: "a", name: "Player A", score: 100 },
  { playerId: "b", name: "Player B", score: 100 },
 ]);
 assert.equal(JSON.stringify(publicLeaderboard([a, b])).includes("secret"), false);
 assert.equal(JSON.stringify(publicLeaderboard([a, b])).includes("streak"), false);
 assert.deepEqual(publicPlayerView(a), { playerId: "b", name: "Player B", score: 100, connected: true });
});
test("TL-REA-002: one active bound socket may submit once per question", () => {
 const valid = { gameState: "playing", connected: true, socketMatchesPlayer: true, alreadyAnswered: false, questionExists: true };
 assert.equal(canSubmitAnswer(valid), true);
 for (const override of [
  { gameState: "lobby" }, { gameState: "finished" }, { connected: false },
  { socketMatchesPlayer: false }, { alreadyAnswered: true }, { questionExists: false },
 ]) assert.equal(canSubmitAnswer({ ...valid, ...override }), false);
});
test("TL-REA-003: leaderboard limits never exceed requested count", () => {
 const data = Array.from({length: 8}, (_, i) => ({ id: String(i), name: String(i), score: i }));
 assert.equal(publicLeaderboard(data).length, 5);
 assert.equal(publicLeaderboard(data, 2).length, 2);
 assert.equal(publicLeaderboard(data, 0).length, 0);
});
