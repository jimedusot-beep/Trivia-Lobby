import { extraCharades } from "./content-extra.js";
import { randomInt, randomUUID } from "node:crypto";
// Original plain-language packs. A fresh shuffle per performer; no repeats within a turn.
export const CHARADES_PACKS = Object.freeze({
  actions: [
    "Brushing your teeth",
    "Flying a kite",
    "Opening an umbrella",
    "Rowing a boat",
    "Baking a cake",
    "Walking a tightrope",
    "Planting a tree",
    "Looking through binoculars",
    "Playing a violin",
    "Wrapping a present",
    "Building a snowman",
    "Climbing a ladder",
    "Carrying a heavy suitcase",
    "Skipping rope",
    "Riding a bicycle",
    "Blowing up a balloon",
    ...extraCharades.actions,
  ],
  animals: [
    "Penguin",
    "Elephant",
    "Kangaroo",
    "Butterfly",
    "Tortoise",
    "Giraffe",
    "Octopus",
    "Rabbit",
    "Crocodile",
    "Flamingo",
    "Gorilla",
    "Owl",
    "Crab",
    "Snake",
    "Frog",
    "Peacock",
    ...extraCharades.animals,
  ],
});
// Keep the historical 16-clue turn length even as the optional bank grows.
// New parties use the original starter sixteen; completed rematches rotate to
// another distinct block. Shuffle only the selected block for each performer.
export function makeTurn(performerId, category, completedMatches = 0) {
  if (!Object.hasOwn(CHARADES_PACKS, category))
    throw new Error("Unknown Charades pack.");
  if (!Number.isSafeInteger(completedMatches) || completedMatches < 0)
    throw new Error("Invalid completed Charades match count.");
  const pool = CHARADES_PACKS[category];
  const offset = ((completedMatches % pool.length) * 16) % pool.length;
  const queue = Array.from({ length: Math.min(16, pool.length) }, (_, index) => ({
    id: randomUUID(),
    text: pool[(offset + index) % pool.length],
  }));
  for (let i = queue.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [queue[i], queue[j]] = [queue[j], queue[i]];
  }
  return { performerId, category, queue, cursor: 0, marks: [] };
}
export function markClue(turn, clueId, result) {
  const clue = turn.queue[turn.cursor];
  if (!clue || clue.id !== clueId)
    throw new Error("That clue is no longer active.");
  if (!["correct", "pass"].includes(result))
    throw new Error("Invalid Charades mark.");
  turn.marks.push({ text: clue.text, result });
  turn.cursor++;
  return result === "correct" ? 1 : 0;
}
export function finishTurn(turn) {
  const clue = turn.queue[turn.cursor];
  if (clue) {
    turn.marks.push({ text: clue.text, result: "unanswered" });
    turn.cursor = turn.queue.length;
  }
}
