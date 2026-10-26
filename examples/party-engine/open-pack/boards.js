// SPDX-License-Identifier: AGPL-3.0-or-later
import {
  createBoard,
  legalMoves,
  moveBoard,
  boardSnapshot,
} from "./board-rules.js";
import {
  fail,
  requireFields,
  integer,
  randomInt,
  playerOnly,
  renewed,
  award,
} from "./shared.js";
export function openBoards(p) {
  p.pack = { kind: "boards", mode: p.mode, tables: [] };
  for (let i = 0; i < p.roster.length; i += 2)
    p.pack.tables.push({
      players: [p.roster[i], p.roster[i + 1] ?? `bot-${i}`],
      game: createBoard(p.mode),
      paid: false,
    });
  renewed(p, 600000);
}
function botTurn(table) {
  let count = 0;
  while (
    !table.game.result &&
    table.players[table.game.turn].startsWith("bot-") &&
    count++ < 64
  ) {
    const legal = legalMoves(table.game);
    if (!legal.length) break;
    moveBoard(table.game, legal[randomInt(legal.length)]);
  }
}
function results(p) {
  for (const t of p.pack.tables) {
    if (t.game.result && !t.paid) {
      t.paid = true;
      if (t.game.result.draw) for (const id of t.players) award(p, id, 50);
      else award(p, t.players[t.game.result.winner], 100);
    }
  }
  if (p.pack.tables.every((t) => t.game.result)) p.enter("reveal");
}
export function acceptBoard(p, actor, v) {
  requireFields(v, ["action", "table"], ["from", "to", "promotion"]);
  playerOnly(p, actor);
  if (!integer(v.table, 0, p.pack.tables.length - 1)) fail("Invalid table.");
  const table = p.pack.tables[v.table],
    g = table.game;
  if (table.players[g.turn] !== actor || g.result)
    fail("Wait for your turn at your own table.");
  if (v.action === "resign") {
    g.result = { winner: 1 - g.turn };
  } else if (v.action === "move") {
    if (
      !integer(v.to, 0, 63) ||
      (v.from !== undefined && !integer(v.from, 0, 63)) ||
      (v.promotion !== undefined && !["q", "r", "b", "n"].includes(v.promotion))
    )
      fail("Invalid board move.");
    moveBoard(g, { to: v.to, from: v.from, promotion: v.promotion });
    botTurn(table);
  } else fail("Unknown board action.");
  p.revision++;
  results(p);
}
export function tickBoards(p) {
  for (const t of p.pack.tables)
    if (!t.game.result)
      t.game.result = { draw: true, reason: "Table time limit reached" };
  results(p);
}
export function projectBoards(p, actor) {
  // Public board geometry is identical for every viewer. Compute legal moves
  // once per revision, rather than once for each of twenty connected phones.
  if (p.pack.snapshotRevision !== p.revision) {
    p.pack.snapshots = p.pack.tables.map(t => boardSnapshot(t.game));
    p.pack.snapshotRevision = p.revision;
  }
  return {
    kind: "boards",
    mode: p.mode,
    tables: p.pack.tables.map((t, index) => ({
      index,
      players: t.players.map((id) => ({
        id,
        name: id.startsWith("bot-") ? "Spark Bot" : p.players.get(id)?.name,
      })),
      ...p.pack.snapshots[index],
      canMove: p.phase === "playing" && t.players[t.game.turn] === actor,
      own: t.players.includes(actor),
    })),
  };
}
