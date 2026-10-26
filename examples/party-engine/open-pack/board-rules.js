// SPDX-License-Identifier: AGPL-3.0-or-later
// Four-in-a-Row scan, Mancala sow/capture flow and Checkers jumps adapted from
// FreeBoardGames.org at 41a0077b7e76c1050b28f67537f00705a9095ed5.
// Reworked for validated actions, paired guest tables, standard two-player rules.
// Reversi is independently implemented. Chess uses chess.js (BSD-2-Clause).
import { Chess } from "chess.js";
import { fail } from "./shared.js";
export const boardKinds = ["four", "chess", "checkers", "reversi", "mancala"];
const xy = (i) => [i % 8, Math.floor(i / 8)],
  at = (x, y) => y * 8 + x,
  inBounds = (x, y) => x >= 0 && x < 8 && y >= 0 && y < 8;
const square = (i) => "abcdefgh"[i % 8] + (8 - Math.floor(i / 8));
const squareIndex = (s) => (8 - Number(s[1])) * 8 + "abcdefgh".indexOf(s[0]);
export function createBoard(kind) {
  const g = { kind, turn: 0, result: null, moves: 0 };
  if (kind === "chess") {
    g.chess = new Chess();
    return g;
  }
  if (kind === "four") g.cells = Array(42).fill(null);
  if (kind === "reversi") {
    g.cells = Array(64).fill(null);
    for (const i of [28, 35]) g.cells[i] = 0;
    for (const i of [27, 36]) g.cells[i] = 1;
  }
  if (kind === "mancala")
    g.cells = Array.from({ length: 14 }, (_, i) =>
      i === 6 || i === 13 ? 0 : 4,
    );
  if (kind === "checkers") {
    g.cells = Array(64).fill(null);
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 8; x++)
        if ((x + y) % 2 && (y < 3 || y > 4)) g.cells[at(x, y)] = y < 3 ? -1 : 1;
    g.jumping = null;
    g.quiet = 0;
  }
  return g;
}
function flips(g, position, side) {
  if (g.cells[position] !== null) return [];
  const [x, y] = xy(position),
    all = [];
  for (let dx = -1; dx <= 1; dx++)
    for (let dy = -1; dy <= 1; dy++) {
      if (!dx && !dy) continue;
      let a = x + dx,
        b = y + dy,
        chain = [];
      while (inBounds(a, b) && g.cells[at(a, b)] === 1 - side) {
        chain.push(at(a, b));
        a += dx;
        b += dy;
      }
      if (chain.length && inBounds(a, b) && g.cells[at(a, b)] === side)
        all.push(...chain);
    }
  return all;
}
function checkerMoves(g, side) {
  const ordinary = [],
    jumps = [];
  for (let from = 0; from < 64; from++) {
    const piece = g.cells[from];
    if (
      piece === null ||
      (piece > 0 ? 0 : 1) !== side ||
      (g.jumping !== null && g.jumping !== from)
    )
      continue;
    const [x, y] = xy(from),
      dirs = Math.abs(piece) === 2 ? [-1, 1] : [side === 0 ? -1 : 1];
    for (const dy of dirs)
      for (const dx of [-1, 1]) {
        const a = x + dx,
          b = y + dy;
        if (!inBounds(a, b)) continue;
        const next = g.cells[at(a, b)];
        if (next === null && g.jumping === null)
          ordinary.push({ from, to: at(a, b) });
        else if (
          next !== null &&
          (next > 0 ? 0 : 1) !== side &&
          inBounds(a + dx, b + dy) &&
          g.cells[at(a + dx, b + dy)] === null
        )
          jumps.push({ from, to: at(a + dx, b + dy), capture: at(a, b) });
      }
  }
  return jumps.length ? jumps : ordinary;
}
export function legalMoves(g, side = g.turn) {
  if (g.result) return [];
  if (g.kind === "chess")
    return g.chess
      .moves({ verbose: true })
      .map((m) => ({
        from: squareIndex(m.from),
        to: squareIndex(m.to),
        ...(m.promotion ? { promotion: m.promotion } : {}),
      }));
  if (g.kind === "four")
    return Array.from({ length: 7 }, (_, to) => ({ to })).filter(
      (m) => g.cells[m.to] === null,
    );
  if (g.kind === "reversi")
    return Array.from({ length: 64 }, (_, to) => ({ to })).filter(
      (m) => flips(g, m.to, side).length,
    );
  if (g.kind === "mancala")
    return Array.from({ length: 6 }, (_, i) => ({
      to: i + (side === 0 ? 0 : 7),
    })).filter((m) => g.cells[m.to] > 0);
  return checkerMoves(g, side);
}
export function moveBoard(g, request) {
  const legal = legalMoves(g).find(
    (m) =>
      m.to === request.to &&
      m.from === request.from &&
      (m.promotion ?? "q") === (request.promotion ?? "q"),
  );
  if (!legal) fail("That move is not legal.");
  const side = g.turn;
  g.moves++;
  if (g.kind === "chess") {
    g.chess.move({
      from: square(legal.from),
      to: square(legal.to),
      promotion: request.promotion ?? "q",
    });
    g.turn = g.chess.turn() === "w" ? 0 : 1;
    if (g.chess.isCheckmate()) g.result = { winner: side };
    else if (g.chess.isDraw() || g.chess.isStalemate())
      g.result = { draw: true };
    return;
  }
  if (g.kind === "four") {
    let row = 5;
    while (g.cells[row * 7 + legal.to] !== null) row--;
    g.cells[row * 7 + legal.to] = side;
    for (let y = 0; y < 6; y++)
      for (let x = 0; x < 7; x++)
        for (const [dx, dy] of [
          [1, 0],
          [0, 1],
          [1, 1],
          [-1, 1],
        ]) {
          if (
            Array.from({ length: 4 }, (_, i) => {
              const a = x + dx * i,
                b = y + dy * i;
              return a >= 0 && a < 7 && b >= 0 && b < 6
                ? g.cells[b * 7 + a]
                : null;
            }).every((v) => v === side)
          )
            g.result = { winner: side };
        }
    if (!g.result && !g.cells.includes(null)) g.result = { draw: true };
    g.turn = 1 - side;
    return;
  }
  if (g.kind === "reversi") {
    for (const i of flips(g, legal.to, side)) g.cells[i] = side;
    g.cells[legal.to] = side;
    g.turn = 1 - side;
    if (!legalMoves(g).length) {
      g.turn = side;
      if (!legalMoves(g).length) {
        const count = [0, 1].map((n) => g.cells.filter((c) => c === n).length);
        g.result =
          count[0] === count[1]
            ? { draw: true }
            : { winner: count[0] > count[1] ? 0 : 1 };
      }
    }
    return;
  }
  if (g.kind === "mancala") {
    let seeds = g.cells[legal.to],
      cursor = legal.to;
    g.cells[cursor] = 0;
    while (seeds) {
      cursor = (cursor + 1) % 14;
      if (cursor === (side === 0 ? 13 : 6)) continue;
      g.cells[cursor]++;
      seeds--;
    }
    const own = (i) => (side === 0 ? i >= 0 && i < 6 : i >= 7 && i < 13),
      store = side === 0 ? 6 : 13;
    if (own(cursor) && g.cells[cursor] === 1 && g.cells[12 - cursor] > 0) {
      g.cells[store] += g.cells[12 - cursor] + 1;
      g.cells[12 - cursor] = 0;
      g.cells[cursor] = 0;
    }
    if (
      [0, 1].some((n) =>
        g.cells.slice(n === 0 ? 0 : 7, n === 0 ? 6 : 13).every((v) => v === 0),
      )
    ) {
      for (const n of [0, 1])
        for (let i = n === 0 ? 0 : 7; i < (n === 0 ? 6 : 13); i++) {
          g.cells[n === 0 ? 6 : 13] += g.cells[i];
          g.cells[i] = 0;
        }
      g.result =
        g.cells[6] === g.cells[13]
          ? { draw: true }
          : { winner: g.cells[6] > g.cells[13] ? 0 : 1 };
    }
    g.turn = cursor === store ? side : 1 - side;
    return;
  }
  const piece = g.cells[legal.from];
  g.cells[legal.from] = null;
  g.cells[legal.to] = piece;
  if (legal.capture !== undefined) g.cells[legal.capture] = null;
  const promoted =
    Math.abs(piece) === 1 && Math.floor(legal.to / 8) === (side === 0 ? 0 : 7);
  if (promoted) g.cells[legal.to] = piece > 0 ? 2 : -2;
  g.quiet =
    legal.capture !== undefined || Math.abs(piece) === 1 ? 0 : g.quiet + 1;
  g.jumping = legal.capture !== undefined && !promoted ? legal.to : null;
  if (
    g.jumping !== null &&
    !checkerMoves(g, side).some((m) => m.capture !== undefined)
  )
    g.jumping = null;
  if (g.jumping === null) g.turn = 1 - side;
  if (!legalMoves(g).length) g.result = { winner: side };
  else if (g.quiet >= 80) g.result = { draw: true };
}
export function boardSnapshot(g) {
  return {
    kind: g.kind,
    turn: g.turn,
    result: g.result,
    moves: g.moves,
    cells:
      g.kind === "chess"
        ? g.chess
            .board()
            .flat()
            .map((c) => (c ? c.color + c.type : null))
        : [...g.cells],
    legal: legalMoves(g).map((m) => ({ ...m })),
    ...(g.kind === "chess"
      ? { check: g.chess.isCheck(), fen: g.chess.fen() }
      : {}),
    ...(g.kind === "checkers" ? { jumping: g.jumping } : {}),
  };
}
