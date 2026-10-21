import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyAnswer, playableQuestions, publicLeaderboard } from "./game-engine";
import type { Card } from "@shared/schema";

function card(id: number, type: string, options: unknown, correctOption: string | null): Card {
  return {
    id, deckId: 1, front: "Test question", back: "Explanation", type,
    options, correctOption, createdAt: new Date(),
  };
}
describe("Multiplayer game engine", () => {
  it("rejects invalid/unsupported cards instead of exposing wrong answers", () => {
    const cards = [
      card(1, "flashcard", null, null),
      card(2, "multiple_choice", ["A", "B"], "D"),
      card(3, "multiple_choice", ["A", "B"], "B"),
    ];
    const questions = playableQuestions(cards);
    assert.equal(questions.length, 1);
    assert.equal(questions[0].correctLetter, "B");
    assert.deepEqual(questions[0].choices, ["A", "B"]);
  });
  it("scores only the first accepted answer per question through the calling protocol", () => {
    const player = { id: "p1", name: "College Student", score: 0, streak: 0, lastPoints: 0 };
    assert.equal(applyAnswer(player, "B", "B"), true);
    assert.equal(player.score, 100);
    assert.equal(applyAnswer(player, "A", "A"), true);
    assert.equal(player.score, 210);
    assert.equal(applyAnswer(player, "B", "C"), false);
    assert.equal(player.score, 210);
    assert.equal(player.streak, 0);
  });
  it("serializes only safe leaderboard fields and sorts scores", () => {
    const players = [
      { id: "1", name: "A", score: 100, streak: 1, lastPoints: 100, ws: { secret: "do not send" } },
      { id: "2", name: "B", score: 200, streak: 2, lastPoints: 110, resumeToken: "never send" },
    ];
    const board = publicLeaderboard(players);
    assert.equal(board[0].name, "B");
    assert.deepEqual(Object.keys(board[0]).sort(), ["lastPoints", "name", "playerId", "score"]);
    assert.doesNotMatch(JSON.stringify(board), /secret|resumeToken|ws/);
  });
});
