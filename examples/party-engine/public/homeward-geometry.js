// SPDX-License-Identifier: AGPL-3.0-or-later
// Original geometry and public rule metadata, shared by server and renderer.
export const TRACK_LENGTH = 48;
export const LANE_LENGTH = 5;
export const PAWNS_PER_PLAYER = 4;
export const HOMEWARD_COLORS = Object.freeze([
  { name: "Coral", ink: "#a82248", light: "#fbe0e7" },
  { name: "Sky", ink: "#235b9e", light: "#dcecff" },
  { name: "Mint", ink: "#146c50", light: "#daf3e8" },
  { name: "Gold", ink: "#805900", light: "#fff0bf" },
]);
export const HOMEWARD_CARDS = Object.freeze({
  1: {
    title: "1 · Launch or advance",
    help: "Bring a pawn out of Start, or advance a pawn by one.",
  },
  2: {
    title: "2 · Go again",
    help: "Launch from Start or advance two. Resolve the card, then draw again.",
  },
  3: { title: "3 · Advance", help: "Advance a pawn by three." },
  4: {
    title: "4 · Reverse",
    help: "Send a pawn backward by four. You can back out of your safe lane.",
  },
  5: { title: "5 · Advance", help: "Advance a pawn by five." },
  7: {
    title: "7 · Advance or split",
    help: "Use all seven on one pawn, or divide them between two pawns in order.",
  },
  8: { title: "8 · Advance", help: "Advance a pawn by eight." },
  10: {
    title: "10 · Forward or back",
    help: "Choose ten forward or one backward.",
  },
  11: {
    title: "11 · Advance or swap",
    help: "Choose eleven forward, or trade track positions with an opponent.",
  },
  12: { title: "12 · Advance", help: "Advance a pawn by twelve." },
  BUMP: {
    title: "Bump! · Launch and capture",
    help: "Send a pawn from Start onto an opponent on the track. They return to Start.",
  },
});
export const DECK_COUNTS = Object.freeze({
  1: 5,
  2: 4,
  3: 4,
  4: 4,
  5: 4,
  7: 4,
  8: 4,
  10: 4,
  11: 4,
  12: 4,
  BUMP: 4,
});
export const entryFor = (color) => color * 12;
export const gateFor = (color) =>
  (entryFor(color) + TRACK_LENGTH - 2) % TRACK_LENGTH;
export function slideAt(position) {
  const offset = position % 12;
  return offset === 2 || offset === 8
    ? {
        color: Math.floor(position / 12),
        start: position,
        end: (position + 3) % TRACK_LENGTH,
        length: 3,
      }
    : null;
}
export function positionLabel(pawn) {
  return pawn.zone === "track"
    ? `Track ${pawn.position + 1}`
    : pawn.zone === "safe"
      ? `Safe ${pawn.position + 1}`
      : pawn.zone === "home"
        ? "Home"
        : "Start";
}
export function ringPoint(position) {
  const step = 700 / 12;
  if (position < 12) return [50 + position * step, 50];
  if (position < 24) return [750, 50 + (position - 12) * step];
  if (position < 36) return [750 - (position - 24) * step, 750];
  return [50, 750 - (position - 36) * step];
}
export function lanePoint(color, index) {
  const [x, y] = ringPoint(gateFor(color)),
    direction = [
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1],
    ][color];
  return [
    x + direction[0] * 55 * (index + 1),
    y + direction[1] * 55 * (index + 1),
  ];
}
export const startPoint = (color) =>
  [
    [245, 245],
    [555, 245],
    [555, 555],
    [245, 555],
  ][color];
