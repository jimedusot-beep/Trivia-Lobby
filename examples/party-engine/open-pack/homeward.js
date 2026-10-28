// SPDX-License-Identifier: AGPL-3.0-or-later
import { fail, requireFields, integer, playerOnly, award } from "./shared.js";
import {
  createHomewardBoard,
  drawHomewardCard,
  legalHomewardMoves,
  applyHomewardMove,
  homewardPassAllowed,
  homewardProgress,
  HOMEWARD_TURN_MS,
  HOMEWARD_MAX_CARDS,
  TRACK_LENGTH,
  LANE_LENGTH,
  PAWNS_PER_PLAYER,
  DECK_COUNTS,
} from "./homeward-rules.js";
const cached = new WeakMap();
function movesFor(board) {
  const prior = cached.get(board);
  if (prior?.version === board.version) return prior.moves;
  const moves = legalHomewardMoves(board);
  cached.set(board, { version: board.version, moves });
  return moves;
}
export function balancedHomewardGroups(roster) {
  if (
    !Array.isArray(roster) ||
    roster.length < 2 ||
    roster.length > 20 ||
    !roster.every(
      (id) => typeof id === "string" && id.length > 0 && id.length <= 80,
    ) ||
    new Set(roster).size !== roster.length
  )
    fail("Start with 2–20 distinct guests.");
  const count = Math.ceil(roster.length / 4),
    groups = [];
  let cursor = 0;
  for (let i = 0; i < count; i++) {
    const size =
      Math.floor(roster.length / count) + (i < roster.length % count ? 1 : 0);
    groups.push(roster.slice(cursor, cursor + size));
    cursor += size;
  }
  return groups;
}
function remember(board, event) {
  board.history.push(event);
  if (board.history.length > 6) board.history.shift();
}
function bankResult(p, board, winner, reason, aborted = false) {
  if (board.result) return;
  if (board.card !== null) {
    board.discards.push(board.card);
    board.card = null;
  }
  const points = board.seats.map((seat, index) =>
    aborted ? 0 : index === winner ? 100 : homewardProgress(seat),
  );
  board.result = { winner, reason, points };
  board.stage = "finished";
  board.deadline = null;
  board.version++;
  if (!board.paid) {
    board.seats.forEach((seat, index) => {
      if (points[index] > 0) award(p, seat.id, points[index]);
    });
    board.paid = true;
  }
}
function sync(p) {
  const live = p.pack.tables.filter((board) => !board.result);
  if (!live.length) p.enter("reveal");
  else
    p.enter(
      "playing",
      Math.max(
        0,
        Math.min(
          ...live.map((board) => Math.min(board.deadline, board.expiresAt)),
        ) - p.clock(),
      ),
    );
}
export function openHomeward(p) {
  p.pack = {
    kind: "homeward",
    schema: 1,
    tables: balancedHomewardGroups(p.roster).map((ids) =>
      createHomewardBoard(ids, p.clock()),
    ),
  };
  sync(p);
}
function finishCard(p, board, event, timeout = false) {
  const card = board.card,
    seat = board.turn;
  if (card !== null) {
    board.discards.push(card);
    board.card = null;
  }
  remember(board, { seat, card, ...event });
  const winner = board.seats.findIndex((s) =>
    s.pawns.every((pawn) => pawn.zone === "home"),
  );
  if (winner >= 0) {
    bankResult(p, board, winner, "Four pawns Home");
    return;
  }
  if (board.draws >= HOMEWARD_MAX_CARDS) {
    bankResult(p, board, null, "Card limit reached · progress points");
    return;
  }
  if (timeout || card !== "2")
    board.turn = (board.turn + 1) % board.seats.length;
  board.stage = "draw";
  board.deadline = Math.min(p.clock() + HOMEWARD_TURN_MS, board.expiresAt);
  board.version++;
}
// Allows an action at an unchanged board after a different board's revision.
// Actor, stage, legal move and exact schema checks still run in acceptHomeward.
export function currentHomewardBoardVersion(p, value) {
  if (
    p.pack?.kind !== "homeward" ||
    !value ||
    !["draw", "move", "pass"].includes(value.action) ||
    !integer(value.table, 0, p.pack.tables.length - 1) ||
    !integer(value.tableVersion, 0, 100000)
  )
    return false;
  return p.pack.tables[value.table].version === value.tableVersion;
}
export function acceptHomeward(p, actor, value) {
  requireFields(value, ["action", "table", "tableVersion"], ["moveId"]);
  playerOnly(p, actor);
  if (!currentHomewardBoardVersion(p, value))
    fail("This board changed. Choose again after synchronization.");
  const board = p.pack.tables[value.table];
  if (board.result) fail("This board is already finished.");
  if (board.seats[board.turn].id !== actor)
    fail("Wait for your turn at your own board.");
  if (value.action === "draw") {
    if (value.moveId !== undefined) fail("A draw does not include a move.");
    if (board.stage !== "draw") fail("Resolve the current card first.");
    drawHomewardCard(board);
  } else if (value.action === "pass") {
    if (
      value.moveId !== undefined ||
      !homewardPassAllowed(board, movesFor(board))
    )
      fail("A mandatory legal move is available.");
    finishCard(p, board, {
      label:
        board.card === "11"
          ? "Declined the optional swap"
          : "No legal move · turn passed",
      bumps: 0,
      slides: 0,
    });
  } else if (value.action === "move") {
    if (typeof value.moveId !== "string" || value.moveId.length > 48)
      fail("Choose a legal move.");
    const move = movesFor(board).find((move) => move.id === value.moveId);
    if (!move) fail("That move is not legal for this card.");
    applyHomewardMove(board, move);
    finishCard(p, board, {
      label: move.label,
      bumps: move.bumps,
      slides: move.slides,
    });
  } else fail("Unknown pawn-race action.");
  sync(p);
}
export function tickHomeward(p) {
  const now = p.clock();
  for (const board of p.pack.tables) {
    if (board.result) continue;
    if (now >= board.expiresAt)
      bankResult(p, board, null, "Time limit reached · progress points");
    else if (now >= board.deadline) {
      if (board.stage === "draw") drawHomewardCard(board);
      finishCard(
        p,
        board,
        {
          label: "Turn timed out · skipped without moving",
          bumps: 0,
          slides: 0,
          timeout: true,
        },
        true,
      );
    }
  }
  sync(p);
}
export function finishHomeward(p) {
  for (const board of p.pack.tables)
    if (!board.result) bankResult(p, board, null, "Host ended the match", true);
}
export function projectHomeward(p, actor) {
  const host = actor === "host";
  return {
    kind: "homeward",
    schema: 1,
    tableCount: p.pack.tables.length,
    tables: p.pack.tables.flatMap((board, index) => {
      const own = board.seats.some((seat) => seat.id === actor);
      if (!host && !own) return [];
      const canAct =
        p.phase === "playing" &&
        !board.result &&
        board.seats[board.turn].id === actor;
      return [
        {
          index,
          version: board.version,
          stage: board.stage,
          turn: board.turn,
          card: board.card,
          draws: board.draws,
          deadline: board.deadline,
          expiresAt: board.expiresAt,
          drawRemaining: board.deck.length,
          discardCount: board.discards.length,
          own,
          canDraw: canAct && board.stage === "draw",
          canChoose: canAct && board.stage === "choose",
          moves:
            canAct && board.stage === "choose"
              ? movesFor(board).map((move) => ({
                  ...move,
                  preview: move.preview.map((pawn) => ({ ...pawn })),
                }))
              : [],
          canPass:
            canAct &&
            board.stage === "choose" &&
            homewardPassAllowed(board, movesFor(board)),
          seats: board.seats.map((seat, seatIndex) => ({
            id: seat.id,
            name: p.players.get(seat.id)?.name ?? "Guest",
            color: seat.color,
            own: seat.id === actor,
            pawns: seat.pawns.map((pawn) => ({ ...pawn })),
            homes: seat.pawns.filter((pawn) => pawn.zone === "home").length,
            points: board.result?.points[seatIndex] ?? homewardProgress(seat),
          })),
          history: board.history.map((event) => ({
            ...event,
            name: p.players.get(board.seats[event.seat].id)?.name ?? "Guest",
          })),
          result: board.result
            ? { ...board.result, points: [...board.result.points] }
            : null,
        },
      ];
    }),
  };
}
export function validateHomewardCheckpoint(pack, roster, phase) {
  const bad = () => {
    throw Error("Unsupported Homeward Hustle recovery state.");
  };
  if (
    pack?.kind !== "homeward" ||
    pack.schema !== 1 ||
    !Array.isArray(pack.tables) ||
    pack.tables.length < 1 ||
    pack.tables.length > 5 ||
    !Array.isArray(roster) ||
    roster.length < 2 ||
    roster.length > 20 ||
    new Set(roster).size !== roster.length
  )
    bad();
  const seen = new Set();
  for (const board of pack.tables) {
    if (
      !board ||
      typeof board !== "object" ||
      Array.isArray(board) ||
      !Array.isArray(board.seats) ||
      board.seats.length < 2 ||
      board.seats.length > 4 ||
      !integer(board.turn, 0, board.seats.length - 1) ||
      !integer(board.version, 0, 100000) ||
      !integer(board.draws, 0, HOMEWARD_MAX_CARDS) ||
      !["draw", "choose", "finished"].includes(board.stage) ||
      !Number.isFinite(board.expiresAt) ||
      !Array.isArray(board.deck) ||
      !Array.isArray(board.discards) ||
      board.deck.length > 45 ||
      board.discards.length > 45 ||
      !Array.isArray(board.history) ||
      board.history.length > 6 ||
      board.history.length > board.draws ||
      typeof board.paid !== "boolean"
    )
      bad();
    const occupied = new Set(),
      colors = new Set();
    for (const seat of board.seats) {
      if (
        !seat ||
        typeof seat !== "object" ||
        Array.isArray(seat) ||
        !roster.includes(seat.id) ||
        seen.has(seat.id) ||
        !integer(seat.color, 0, 3) ||
        colors.has(seat.color) ||
        !Array.isArray(seat.pawns) ||
        seat.pawns.length !== PAWNS_PER_PLAYER
      )
        bad();
      seen.add(seat.id);
      colors.add(seat.color);
      for (const pawn of seat.pawns) {
        if (!pawn || !["start", "track", "safe", "home"].includes(pawn.zone))
          bad();
        if (pawn.zone === "start" || pawn.zone === "home") {
          if (pawn.position !== null) bad();
        } else {
          if (
            !integer(
              pawn.position,
              0,
              pawn.zone === "track" ? TRACK_LENGTH - 1 : LANE_LENGTH - 1,
            )
          )
            bad();
          const key =
            pawn.zone === "track"
              ? `track:${pawn.position}`
              : `safe:${seat.color}:${pawn.position}`;
          if (occupied.has(key)) bad();
          occupied.add(key);
        }
      }
    }
    const inventory = Object.fromEntries(
      Object.keys(DECK_COUNTS).map((card) => [card, 0]),
    );
    for (const card of [
      ...board.deck,
      ...board.discards,
      ...(board.card === null ? [] : [board.card]),
    ]) {
      if (typeof card !== "string" || !Object.hasOwn(DECK_COUNTS, card)) bad();
      inventory[card]++;
    }
    if (
      Object.keys(inventory).some(
        (card) => inventory[card] !== DECK_COUNTS[card],
      )
    )
      bad();
    for (const event of board.history)
      if (
        !event ||
        !integer(event.seat, 0, board.seats.length - 1) ||
        !Object.hasOwn(DECK_COUNTS, event.card) ||
        typeof event.label !== "string" ||
        event.label.length > 180 ||
        !integer(event.bumps, 0, 16) ||
        !integer(event.slides, 0, 2)
      )
        bad();
    if (board.result) {
      if (
        board.stage !== "finished" ||
        board.card !== null ||
        board.deadline !== null ||
        !board.paid ||
        (board.result.winner !== null &&
          !integer(board.result.winner, 0, board.seats.length - 1)) ||
        typeof board.result.reason !== "string" ||
        board.result.reason.length > 100 ||
        !Array.isArray(board.result.points) ||
        board.result.points.length !== board.seats.length ||
        !board.result.points.every((points) => integer(points, 0, 100))
      )
        bad();
      if (
        board.result.winner !== null &&
        !board.seats[board.result.winner].pawns.every(
          (pawn) => pawn.zone === "home",
        )
      )
        bad();
      const reasons = [
        "Four pawns Home",
        "Card limit reached · progress points",
        "Time limit reached · progress points",
        "Host ended the match",
      ];
      if (
        !reasons.includes(board.result.reason) ||
        (board.result.winner !== null) !==
          (board.result.reason === "Four pawns Home") ||
        (board.result.winner !== null &&
          (board.result.winner !== board.turn || board.draws < 1)) ||
        board.result.points.some(
          (points, index) =>
            points !==
            (board.result.reason === "Host ended the match"
              ? 0
              : index === board.result.winner
                ? 100
                : homewardProgress(board.seats[index])),
        )
      )
        bad();
    } else {
      if (
        board.paid ||
        board.stage === "finished" ||
        board.version < board.draws ||
        (board.stage === "choose" && board.draws < 1) ||
        !Number.isFinite(board.deadline) ||
        board.deadline > board.expiresAt ||
        (board.stage === "draw"
          ? board.card !== null
          : !Object.hasOwn(DECK_COUNTS, board.card)) ||
        board.seats.some((seat) =>
          seat.pawns.every((pawn) => pawn.zone === "home"),
        )
      )
        bad();
    }
  }
  if (
    seen.size !== roster.length ||
    (phase === "playing" && pack.tables.every((board) => board.result)) ||
    (["reveal", "finished"].includes(phase) &&
      pack.tables.some((board) => !board.result))
  )
    bad();
}
