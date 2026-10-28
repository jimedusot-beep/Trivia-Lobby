// SPDX-License-Identifier: AGPL-3.0-or-later
// Original card/pawn rules. This module has no transport, DOM or score authority.
import { randomInt, shuffle } from "./shared.js";
import {
  TRACK_LENGTH,
  LANE_LENGTH,
  PAWNS_PER_PLAYER,
  DECK_COUNTS,
  entryFor,
  gateFor,
  slideAt,
  positionLabel,
} from "../public/homeward-geometry.js";
export { TRACK_LENGTH, LANE_LENGTH, PAWNS_PER_PLAYER, DECK_COUNTS };
export const HOMEWARD_TURN_MS = 30000;
export const HOMEWARD_BOARD_MS = 900000;
export const HOMEWARD_MAX_CARDS = 600;
export function freshHomewardDeck() {
  return Object.entries(DECK_COUNTS).flatMap(([card, count]) =>
    Array(count).fill(card),
  );
}
export function createHomewardBoard(players, now) {
  if (
    !Array.isArray(players) ||
    players.length < 2 ||
    players.length > 4 ||
    new Set(players).size !== players.length
  )
    throw Error("A board needs 2–4 distinct players.");
  return {
    version: 0,
    turn: randomInt(players.length),
    stage: "draw",
    card: null,
    deck: shuffle(freshHomewardDeck()),
    discards: [],
    draws: 0,
    deadline: now + HOMEWARD_TURN_MS,
    expiresAt: now + HOMEWARD_BOARD_MS,
    seats: players.map((id, index) => {
      const color = players.length === 2 ? index * 2 : index;
      return {
        id,
        color,
        pawns: Array.from({ length: PAWNS_PER_PLAYER }, (_, pawn) =>
          pawn === 0
            ? { zone: "track", position: entryFor(color) }
            : { zone: "start", position: null },
        ),
      };
    }),
    history: [],
    result: null,
    paid: false,
  };
}
export function drawHomewardCard(game) {
  if (game.card !== null || game.stage !== "draw" || game.result)
    throw Error("A card is already active.");
  if (!game.deck.length) {
    game.deck = shuffle(game.discards);
    game.discards = [];
  }
  if (!game.deck.length) throw Error("The card deck is incomplete.");
  game.card = game.deck.pop();
  game.stage = "choose";
  game.draws++;
  game.version++;
  return game.card;
}
const copySeats = (game) =>
  game.seats.map((seat) => ({
    ...seat,
    pawns: seat.pawns.map((pawn) => ({ ...pawn })),
  }));
function advance(pawn, color, steps) {
  if (pawn.zone === "start" || pawn.zone === "home") return null;
  let next = { ...pawn };
  for (let n = 0; n < Math.abs(steps); n++) {
    if (next.zone === "home") return null;
    if (steps > 0) {
      if (next.zone === "track")
        next =
          next.position === gateFor(color)
            ? { zone: "safe", position: 0 }
            : { zone: "track", position: (next.position + 1) % TRACK_LENGTH };
      else
        next =
          next.position === LANE_LENGTH - 1
            ? { zone: "home", position: null }
            : { zone: "safe", position: next.position + 1 };
    } else {
      if (next.zone === "track")
        next.position = (next.position + TRACK_LENGTH - 1) % TRACK_LENGTH;
      else
        next =
          next.position === 0
            ? { zone: "track", position: gateFor(color) }
            : { zone: "safe", position: next.position - 1 };
    }
  }
  return next;
}
function land(seats, seatIndex, pawnIndex, destination, events) {
  const moving = seats[seatIndex],
    slide = destination.zone === "track" ? slideAt(destination.position) : null;
  if (slide && slide.color !== moving.color) {
    const swept = new Set(
      Array.from(
        { length: slide.length + 1 },
        (_, i) => (slide.start + i) % TRACK_LENGTH,
      ),
    );
    for (let s = 0; s < seats.length; s++)
      for (let p = 0; p < PAWNS_PER_PLAYER; p++) {
        const pawn = seats[s].pawns[p];
        if (
          (s !== seatIndex || p !== pawnIndex) &&
          pawn.zone === "track" &&
          swept.has(pawn.position)
        ) {
          seats[s].pawns[p] = { zone: "start", position: null };
          events.push({ kind: "bump", seat: s, pawn: p });
        }
      }
    seats[seatIndex].pawns[pawnIndex] = { zone: "track", position: slide.end };
    events.push({ kind: "slide", from: slide.start, to: slide.end });
    return true;
  }
  if (destination.zone !== "home") {
    for (let s = 0; s < seats.length; s++)
      for (let p = 0; p < PAWNS_PER_PLAYER; p++) {
        if (s === seatIndex && p === pawnIndex) continue;
        const other = seats[s].pawns[p];
        const occupied =
          destination.zone === "track"
            ? other.zone === "track" && other.position === destination.position
            : s === seatIndex &&
              other.zone === "safe" &&
              other.position === destination.position;
        if (occupied) {
          if (s === seatIndex) return false;
          seats[s].pawns[p] = { zone: "start", position: null };
          events.push({ kind: "bump", seat: s, pawn: p });
        }
      }
  }
  seats[seatIndex].pawns[pawnIndex] = destination;
  return true;
}
function step(seats, seat, pawn, steps, events) {
  const destination = advance(
    seats[seat].pawns[pawn],
    seats[seat].color,
    steps,
  );
  return !!destination && land(seats, seat, pawn, destination, events);
}
// Simulates into a detached position. A failed second split leg cannot mutate play.
export function simulateHomewardMove(game, move) {
  if (
    game.stage !== "choose" ||
    !Object.hasOwn(DECK_COUNTS, game.card) ||
    game.result
  )
    return null;
  const seats = copySeats(game),
    events = [],
    seat = game.turn,
    current = seats[seat];
  if (
    !current ||
    !Number.isInteger(move.pawn) ||
    move.pawn < 0 ||
    move.pawn >= PAWNS_PER_PLAYER
  )
    return null;
  if (move.kind === "launch") {
    if (
      current.pawns[move.pawn].zone !== "start" ||
      !["1", "2"].includes(game.card)
    )
      return null;
    if (
      !land(
        seats,
        seat,
        move.pawn,
        { zone: "track", position: entryFor(current.color) },
        events,
      )
    )
      return null;
  } else if (move.kind === "step") {
    const allowed =
      game.card === "4"
        ? [-4]
        : game.card === "10"
          ? [10, -1]
          : game.card === "BUMP"
            ? []
            : [Number(game.card)];
    if (
      !Number.isInteger(move.steps) ||
      !allowed.includes(move.steps) ||
      !step(seats, seat, move.pawn, move.steps, events)
    )
      return null;
  } else if (move.kind === "split") {
    if (
      game.card !== "7" ||
      !Number.isInteger(move.secondPawn) ||
      move.secondPawn === move.pawn ||
      move.secondPawn < 0 ||
      move.secondPawn >= PAWNS_PER_PLAYER ||
      !Number.isInteger(move.firstSteps) ||
      move.firstSteps < 1 ||
      move.firstSteps > 6
    )
      return null;
    if (
      !step(seats, seat, move.pawn, move.firstSteps, events) ||
      !step(seats, seat, move.secondPawn, 7 - move.firstSteps, events)
    )
      return null;
  } else if (move.kind === "swap" || move.kind === "bump") {
    if (game.card !== (move.kind === "swap" ? "11" : "BUMP")) return null;
    if (
      !Number.isInteger(move.targetSeat) ||
      move.targetSeat === seat ||
      move.targetSeat < 0 ||
      move.targetSeat >= seats.length ||
      !Number.isInteger(move.targetPawn) ||
      move.targetPawn < 0 ||
      move.targetPawn >= PAWNS_PER_PLAYER
    )
      return null;
    const own = current.pawns[move.pawn],
      target = seats[move.targetSeat].pawns[move.targetPawn];
    if (
      target.zone !== "track" ||
      (move.kind === "swap" ? own.zone !== "track" : own.zone !== "start")
    )
      return null;
    const destination = { ...target };
    if (move.kind === "swap")
      seats[move.targetSeat].pawns[move.targetPawn] = { ...own };
    else {
      seats[move.targetSeat].pawns[move.targetPawn] = {
        zone: "start",
        position: null,
      };
      events.push({
        kind: "bump",
        seat: move.targetSeat,
        pawn: move.targetPawn,
      });
    }
    if (!land(seats, seat, move.pawn, destination, events)) return null;
  } else return null;
  return { seats, events };
}
function candidates(game) {
  const all = [],
    card = game.card;
  for (let pawn = 0; pawn < PAWNS_PER_PLAYER; pawn++) {
    if (
      ["1", "2"].includes(card) &&
      game.seats[game.turn].pawns[pawn].zone === "start"
    )
      all.push({ id: `launch:${pawn}`, kind: "launch", pawn });
    const distances =
      card === "4"
        ? [-4]
        : card === "10"
          ? [10, -1]
          : card === "BUMP"
            ? []
            : [Number(card)];
    for (const steps of distances)
      all.push({ id: `step:${pawn}:${steps}`, kind: "step", pawn, steps });
    if (card === "7")
      for (let secondPawn = 0; secondPawn < PAWNS_PER_PLAYER; secondPawn++)
        if (secondPawn !== pawn)
          for (let firstSteps = 1; firstSteps <= 6; firstSteps++)
            all.push({
              id: `split:${pawn}:${secondPawn}:${firstSteps}`,
              kind: "split",
              pawn,
              secondPawn,
              firstSteps,
            });
    if (card === "11" || card === "BUMP")
      for (let targetSeat = 0; targetSeat < game.seats.length; targetSeat++)
        if (targetSeat !== game.turn)
          for (let targetPawn = 0; targetPawn < PAWNS_PER_PLAYER; targetPawn++)
            all.push({
              id: `${card === "11" ? "swap" : "bump"}:${pawn}:${targetSeat}:${targetPawn}`,
              kind: card === "11" ? "swap" : "bump",
              pawn,
              targetSeat,
              targetPawn,
            });
  }
  return all;
}
const letter = (index) => String.fromCharCode(65 + index);
export function describeHomewardMove(move) {
  if (move.kind === "launch") return `Launch pawn ${letter(move.pawn)}`;
  if (move.kind === "split")
    return `${letter(move.pawn)} +${move.firstSteps}, then ${letter(move.secondPawn)} +${7 - move.firstSteps}`;
  if (move.kind === "swap")
    return `Swap ${letter(move.pawn)} with player ${move.targetSeat + 1}'s ${letter(move.targetPawn)}`;
  if (move.kind === "bump")
    return `Launch ${letter(move.pawn)} and bump player ${move.targetSeat + 1}'s ${letter(move.targetPawn)}`;
  return `${letter(move.pawn)} ${move.steps > 0 ? "+" : ""}${move.steps}`;
}
export function legalHomewardMoves(game) {
  if (game.stage !== "choose" || !game.card || game.result) return [];
  return candidates(game).flatMap((move) => {
    const simulation = simulateHomewardMove(game, move);
    if (!simulation) return [];
    const pawns = [
      move.pawn,
      ...(move.kind === "split" ? [move.secondPawn] : []),
    ];
    return [
      {
        ...move,
        label: describeHomewardMove(move),
        preview: pawns.map((pawn) => ({
          pawn,
          ...simulation.seats[game.turn].pawns[pawn],
        })),
        bumps: simulation.events.filter((event) => event.kind === "bump")
          .length,
        slides: simulation.events.filter((event) => event.kind === "slide")
          .length,
      },
    ];
  });
}
export function homewardPassAllowed(game, moves = legalHomewardMoves(game)) {
  return (
    game.stage === "choose" &&
    (!moves.length ||
      (game.card === "11" && moves.every((move) => move.kind === "swap")))
  );
}
export function applyHomewardMove(game, move) {
  const simulation = simulateHomewardMove(game, move);
  if (!simulation) throw Error("That move cannot be completed.");
  game.seats = simulation.seats;
  return simulation.events;
}
export function homewardProgress(seat) {
  return seat.pawns.reduce(
    (sum, pawn) =>
      sum + (pawn.zone === "home" ? 20 : pawn.zone === "safe" ? 5 : 0),
    0,
  );
}
export function homewardPreview(move) {
  const destinations = move.preview
    .map((pawn) => `${letter(pawn.pawn)} → ${positionLabel(pawn)}`)
    .join("; ");
  return (
    destinations +
    (move.bumps ? ` · ${move.bumps} bumped` : "") +
    (move.slides
      ? ` · ${move.slides} slide${move.slides === 1 ? "" : "s"}`
      : "")
  );
}
