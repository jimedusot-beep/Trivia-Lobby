// SPDX-License-Identifier: MIT
// Adapted from Unoverse, copyright (c) 2026 Tanmay Tiwari.
// Exact upstream revision and modifications: docs/OPEN_GAME_SOURCES.json.
// Modifications: JavaScript, cryptographic shuffle/IDs, original card labels.
import { randomUUID, shuffle } from "./shared.js";
export const colors = ["red", "blue", "green", "yellow"];
export function generateDeck() {
  const deck = [];
  for (const color of colors) {
    deck.push({ id: randomUUID(), color, value: "0" });
    for (const value of [
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      "skip",
      "reverse",
      "draw_two",
    ]) {
      for (let n = 0; n < 2; n++) deck.push({ id: randomUUID(), color, value });
    }
  }
  for (let n = 0; n < 4; n++)
    for (const value of ["wild", "wild_draw_four"])
      deck.push({ id: randomUUID(), color: "wild", value });
  return shuffle(deck);
}
export function nextIndex(index, direction, count, steps = 1) {
  if (count <= 0) return 0;
  if (count === 2 && steps > 1) return index;
  return (index + (direction === 1 ? steps : -steps) + count * 10) % count;
}
export function cardPoints(card) {
  switch (card.value) {
    case "skip":
    case "reverse":
    case "draw_two":
      return 20;
    case "wild":
    case "wild_draw_four":
      return 50;
    default: {
      const n = Number(card.value);
      return Number.isFinite(n) ? n : 0;
    }
  }
}
export const roundPoints = (hands, winner) =>
  Object.entries(hands)
    .filter(([id]) => id !== winner)
    .reduce(
      (sum, [, hand]) => sum + hand.reduce((n, c) => n + cardPoints(c), 0),
      0,
    );
