import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Party } from "../engine.js";
import {
  balancedHomewardGroups,
  validateHomewardCheckpoint,
} from "../open-pack/homeward.js";
import {
  legalHomewardMoves,
  simulateHomewardMove,
  freshHomewardDeck,
} from "../open-pack/homeward-rules.js";
import { snapshotParty, restoreParty } from "../party-checkpoint.js";
import { entryFor, gateFor } from "../public/homeward-geometry.js";
let sequence = 0;
function game(count = 4) {
  let now = 1000;
  const options = { clock: () => now, countdownMs: 1 },
    p = new Party("HMRA23", options);
  const ids = Array.from({ length: count }, (_, i) =>
    p.join(`Player ${i + 1}`),
  );
  const message = (type, value, extra = {}) => ({
    v: 1,
    type,
    requestId: `homeward-test-${++sequence}`,
    matchId: p.matchId,
    revision: p.revision,
    ...(value === undefined ? {} : { value }),
    ...extra,
  });
  const send = (actor, type, value, extra) =>
    p.handle(actor, message(type, value, extra));
  send("host", "start", "homeward");
  now++;
  p.tick();
  const act = (index, action, extra = {}, actor) => {
    const board = p.pack.tables[index];
    return send(actor ?? board.seats[board.turn].id, "play", {
      action,
      table: index,
      tableVersion: board.version,
      ...extra,
    });
  };
  return {
    p,
    ids,
    options,
    message,
    send,
    act,
    advance: (ms) => {
      now += ms;
      p.tick();
    },
    next: () => send("host", "next"),
    restore: (target) =>
      restoreParty(
        p.code,
        JSON.parse(JSON.stringify(snapshotParty(target ?? p))),
        options,
        now,
      ),
  };
}
function arrangeCard(board, card) {
  assert.equal(board.stage, "draw");
  let index = board.deck.indexOf(card);
  if (index < 0) {
    const at = board.discards.indexOf(card);
    assert(at >= 0);
    if (board.deck.length) {
      [board.deck[board.deck.length - 1], board.discards[at]] = [
        board.discards[at],
        board.deck[board.deck.length - 1],
      ];
      index = board.deck.length - 1;
    } else {
      board.deck.push(board.discards.splice(at, 1)[0]);
      index = 0;
    }
  }
  [board.deck[index], board.deck[board.deck.length - 1]] = [
    board.deck[board.deck.length - 1],
    board.deck[index],
  ];
}
function firstMove(g, index = 0) {
  const board = g.p.pack.tables[index],
    move = legalHomewardMoves(board)[0];
  assert(move);
  g.act(index, "move", { moveId: move.id });
  return move;
}
test("all room sizes 2–20 form balanced 2–4-player boards and preserve nickname-only roles", () => {
  for (let n = 2; n <= 20; n++) {
    const g = game(n),
      groups = balancedHomewardGroups(g.ids);
    assert.equal(groups.length, Math.ceil(n / 4));
    assert.deepEqual(groups.flat(), g.ids);
    assert(groups.every((ids) => ids.length >= 2 && ids.length <= 4));
    const sizes = groups.map((ids) => ids.length);
    assert(Math.max(...sizes) - Math.min(...sizes) <= 1);
    assert.equal(g.p.view("host").pack.tables.length, groups.length);
    for (const id of g.ids) {
      const v = g.p.view(id).pack;
      assert.equal(v.tables.length, 1);
      assert.equal(v.tables[0].seats.filter((s) => s.own).length, 1);
      assert.equal(v.tables[0].tableCount, undefined);
    }
    validateHomewardCheckpoint(g.p.pack, g.ids, g.p.phase);
  }
  assert.throws(() => balancedHomewardGroups(["one"]), /2–20/);
});
test("draw/move permissions, payload schemas and card ownership reject forgery without mutation", () => {
  const g = game(),
    { p } = g,
    b = p.pack.tables[0],
    owner = b.seats[b.turn].id,
    other = b.seats[(b.turn + 1) % 4].id;
  let before = structuredClone(p.pack),
    revision = p.revision;
  assert.throws(() => g.act(0, "draw", {}, "host"), /joined players/);
  assert.throws(() => g.act(0, "draw", {}, other), /own board/);
  assert.throws(() => g.act(0, "draw", { points: 1000 }), /fields/);
  assert.deepEqual(p.pack, before);
  assert.equal(p.revision, revision);
  g.act(0, "draw");
  before = structuredClone(p.pack);
  revision = p.revision;
  assert.throws(() => g.act(0, "draw"), /Resolve/);
  assert.throws(() => g.act(0, "move", { moveId: "step:0:999" }), /not legal/);
  assert.throws(
    () => g.act(0, "move", { moveId: "step:0:1", winner: owner }),
    /fields/,
  );
  assert.throws(() => g.act(0, "pass"), /mandatory/);
  assert.deepEqual(p.pack, before);
  assert.equal(p.revision, revision);
  firstMove(g);
});
test("independent boards accept simultaneous base revisions but reject stale local versions and future revisions", () => {
  const g = game(8),
    { p } = g,
    [one, two] = p.pack.tables;
  const first = g.message("play", {
    action: "draw",
    table: 0,
    tableVersion: one.version,
  });
  const second = g.message("play", {
    action: "draw",
    table: 1,
    tableVersion: two.version,
  });
  p.handle(one.seats[one.turn].id, first);
  p.handle(two.seats[two.turn].id, second);
  assert.equal(one.stage, "choose");
  assert.equal(two.stage, "choose");
  assert.throws(
    () =>
      g.send(one.seats[one.turn].id, "play", {
        action: "move",
        table: 0,
        tableVersion: 0,
        moveId: legalHomewardMoves(one)[0].id,
      }),
    /board changed/,
  );
  assert.throws(
    () =>
      g.send(
        one.seats[one.turn].id,
        "play",
        {
          action: "move",
          table: 0,
          tableVersion: one.version,
          moveId: legalHomewardMoves(one)[0].id,
        },
        { revision: p.revision + 1 },
      ),
    /out of date/,
  );
  assert.throws(
    () =>
      g.send(one.seats[one.turn].id, "play", {
        action: "move",
        table: 1,
        tableVersion: two.version,
        moveId: legalHomewardMoves(two)[0].id,
      }),
    /own board/,
  );
  assert.throws(
    () =>
      g.send(
        one.seats[one.turn].id,
        "play",
        {
          action: "move",
          table: 0,
          tableVersion: one.version,
          moveId: legalHomewardMoves(one)[0].id,
        },
        { matchId: randomUUID() },
      ),
    /out of date/,
  );
});
test("undealt cards stay hidden even from host; only the current actor receives legal choices", () => {
  const g = game(20),
    { p } = g,
    b = p.pack.tables[0],
    owner = b.seats[b.turn].id;
  arrangeCard(b, "7");
  g.act(0, "draw");
  for (const id of ["host", ...g.ids]) {
    const v = p.view(id),
      raw = JSON.stringify(v);
    assert(!raw.includes('"deck":'));
    assert(!raw.includes('"discards":'));
    if (id !== owner)
      for (const table of v.pack.tables) assert.equal(table.moves.length, 0);
    assert(
      Buffer.byteLength(raw) < 32768,
      `State frame for ${id} exceeded 32 KiB`,
    );
  }
  assert(p.view(owner).pack.tables[0].moves.length > 0);
  const view = p.view(owner);
  view.pack.tables[0].seats[0].pawns[0].zone = "home";
  assert.notEqual(p.pack.tables[0].seats[0].pawns[0].zone, "home");
});
test("drawing never extends the turn and one board cannot extend another board's deadline", () => {
  const g = game(8),
    { p } = g,
    [one, two] = p.pack.tables,
    deadline = two.deadline;
  g.advance(1000);
  g.act(0, "draw");
  assert.equal(one.deadline, deadline);
  firstMove(g);
  assert(one.deadline > deadline);
  assert.equal(two.deadline, deadline);
  assert.equal(p.deadline, deadline);
  const version = one.version,
    positions = structuredClone(two.seats),
    turn = two.turn;
  g.advance(29000);
  assert.equal(one.version, version);
  assert.deepEqual(two.seats, positions);
  assert.equal(two.turn, (turn + 1) % two.seats.length);
  assert.equal(two.history.at(-1).timeout, true);
});
test("twos grant another card after a move or blocked pass, while a timeout always skips", () => {
  const g = game(),
    b = g.p.pack.tables[0],
    turn = b.turn;
  arrangeCard(b, "2");
  g.act(0, "draw");
  firstMove(g);
  assert.equal(b.turn, turn);
  b.seats[turn].pawns = [
    { zone: "home", position: null },
    { zone: "home", position: null },
    { zone: "home", position: null },
    { zone: "safe", position: 4 },
  ];
  arrangeCard(b, "2");
  g.act(0, "draw");
  assert.equal(legalHomewardMoves(b).length, 0);
  g.act(0, "pass");
  assert.equal(b.turn, turn);
  arrangeCard(b, "2");
  g.act(0, "draw");
  g.advance(30000);
  assert.equal(b.turn, (turn + 1) % b.seats.length);
  assert.equal(b.history.at(-1).timeout, true);
});
test("a completed board awards once while other boards continue; abort adds no unfinished points", () => {
  const g = game(8),
    { p } = g,
    b = p.pack.tables[0],
    winner = b.turn,
    id = b.seats[winner].id;
  b.seats[winner].pawns = [
    { zone: "home", position: null },
    { zone: "home", position: null },
    { zone: "home", position: null },
    { zone: "safe", position: 4 },
  ];
  arrangeCard(b, "1");
  g.act(0, "draw");
  const move = legalHomewardMoves(b).find((m) => m.pawn === 3),
    message = g.message("play", {
      action: "move",
      table: 0,
      tableVersion: b.version,
      moveId: move.id,
    });
  p.handle(id, message);
  p.handle(id, message);
  assert.equal(p.phase, "playing");
  assert.equal(b.result.winner, winner);
  assert.equal(p.players.get(id).score, 100);
  assert.throws(() => g.act(0, "draw"), /finished/);
  g.send("host", "play", { action: "end-match" });
  assert.equal(p.phase, "finished");
  assert.equal(p.players.get(id).score, 100);
  assert(p.pack.tables[1].result.points.every((points) => points === 0));
  assert.equal(p.championship.games.length, 0);
  const restored = g.restore();
  assert.equal(restored.players.get(id).score, 100);
  validateHomewardCheckpoint(restored.pack, g.ids, restored.phase);
});
test("all-idle tables settle with no winner and zero score; repeated Next cannot award again", () => {
  const g = game(),
    { p } = g;
  g.advance(900000);
  assert.equal(p.phase, "reveal");
  assert.equal(p.pack.tables[0].result.winner, null);
  assert([...p.players.values()].every((player) => player.score === 0));
  const snapshot = g.restore();
  assert.equal(snapshot.pack.tables[0].paid, true);
  g.next();
  assert.equal(p.phase, "finished");
  assert(
    [...p.championship.entries.values()].every((entry) => entry.points === 0),
  );
  assert.throws(() => g.next(), /after reveal/);
});
test("JSON checkpoints retain private card order, choice stage, version and replay guards", () => {
  const g = game(),
    { p } = g,
    b = p.pack.tables[0];
  arrangeCard(b, "11");
  g.act(0, "draw");
  const restored = g.restore();
  assert.deepEqual(restored.pack, p.pack);
  assert.deepEqual(
    legalHomewardMoves(restored.pack.tables[0]),
    legalHomewardMoves(b),
  );
  assert.equal(restored.pack.tables[0].card, "11");
  const actor = b.seats[b.turn].id,
    m = g.message("play", {
      action: "move",
      table: 0,
      tableVersion: b.version,
      moveId: legalHomewardMoves(b)[0].id,
    });
  p.handle(actor, m);
  const after = g.restore();
  const before = structuredClone(after.pack);
  after.handle(actor, m);
  assert.deepEqual(after.pack, before);
  const nextMove = {
    v: 1,
    type: "play",
    requestId: `homeward-recovered-${++sequence}`,
    matchId: after.matchId,
    revision: after.revision,
    value: {
      action: "draw",
      table: 0,
      tableVersion: after.pack.tables[0].version,
    },
  };
  after.handle(
    after.pack.tables[0].seats[after.pack.tables[0].turn].id,
    nextMove,
  );
  assert.equal(after.pack.tables[0].stage, "choose");
});
test("same-room lobby recovery permits new guests after a completed pawn race", () => {
  const g = game(2),
    { p } = g;
  g.advance(900000);
  g.next();
  g.send("host", "lobby");
  const joined = p.join("Next game guest"),
    recovered = g.restore();
  assert.equal(recovered.phase, "lobby");
  assert(recovered.players.has(joined));
  recovered.connected("host", true);
  for (const id of recovered.players.keys()) recovered.connected(id, true);
  recovered.handle("host", {
    v: 1,
    type: "start",
    value: "homeward",
    requestId: "homeward-next-match",
    matchId: null,
    revision: recovered.revision,
  });
  g.advance(1);
  recovered.tick();
  assert.equal(recovered.phase, "playing");
  assert.equal(recovered.pack.tables[0].seats.length, 3);
  validateHomewardCheckpoint(
    recovered.pack,
    [...recovered.players.keys()],
    recovered.phase,
  );
});
test("incomplete or contradictory checkpoints fail instead of resetting the board or repaying", () => {
  const g = game(),
    good = snapshotParty(g.p);
  const corrupt = [
    (s) => {
      s.pack.tables[0] = null;
    },
    (s) => {
      s.pack.tables[0].seats[0] = null;
    },
    (s) => {
      s.pack.schema = 2;
    },
    (s) => {
      s.pack.tables[0].deck.pop();
    },
    (s) => {
      s.pack.tables[0].seats[1].pawns[0] = {
        ...s.pack.tables[0].seats[0].pawns[0],
      };
    },
    (s) => {
      s.pack.tables[0].seats[0].pawns[1] = { zone: "safe", position: 5 };
    },
    (s) => {
      s.pack.tables[0].stage = "choose";
    },
    (s) => {
      s.pack.tables[0].paid = true;
    },
    (s) => {
      s.pack.tables[0].turn = 99;
    },
    (s) => {
      s.pack.tables[0].seats[1].id = s.pack.tables[0].seats[0].id;
    },
  ];
  for (const edit of corrupt) {
    const state = structuredClone(good);
    edit(state);
    assert.throws(
      () => restoreParty(g.p.code, state, g.options, 1001),
      /Homeward/,
    );
  }
});
function seededDeck(seed, source = freshHomewardDeck()) {
  const deck = [...source];
  let state = seed + 1;
  for (let i = deck.length - 1; i > 0; i--) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const j = state % (i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
function progress(seat) {
  return seat.pawns.reduce(
    (sum, pawn) =>
      sum +
      (pawn.zone === "home"
        ? 300
        : pawn.zone === "safe"
          ? 100 + pawn.position
          : pawn.zone === "start"
            ? -10
            : 52 - (((gateFor(seat.color) - pawn.position + 48) % 48) + 6)),
    0,
  );
}
test("27 varied complete games terminate, conserve cards and positions, and never duplicate payouts", () => {
  let natural = 0;
  for (const n of [2, 3, 4])
    for (let seed = 0; seed < 9; seed++) {
      const g = game(n),
        { p } = g,
        b = p.pack.tables[0];
      b.deck = seededDeck(seed);
      b.turn = seed % n;
      let cards = 0;
      while (p.phase === "playing" && cards++ < 601) {
        if (b.stage === "draw") {
          if (!b.deck.length) {
            b.deck = seededDeck(seed + b.draws * 31, b.discards);
            b.discards = [];
          }
          g.act(0, "draw");
        }
        const options = legalHomewardMoves(b);
        if (!options.length) g.act(0, "pass");
        else {
          let best = options[0],
            score = -Infinity;
          for (const option of options) {
            const sim = simulateHomewardMove(b, option),
              value = progress(sim.seats[b.turn]) + option.bumps * 0.1;
            if (value > score) {
              score = value;
              best = option;
            }
          }
          g.act(0, "move", { moveId: best.id });
        }
        if (cards % 20 === 0)
          validateHomewardCheckpoint(p.pack, g.ids, p.phase);
      }
      assert.equal(p.phase, "reveal", `n=${n}, seed=${seed}`);
      assert(b.draws <= 600);
      validateHomewardCheckpoint(p.pack, g.ids, p.phase);
      if (b.result.winner !== null) natural++;
      const scores = [...p.players.values()].map((value) => value.score);
      g.next();
      assert.deepEqual(
        [...p.players.values()].map((value) => value.score),
        scores,
      );
      assert(scores.every((value) => value >= 0 && value <= 100));
    }
  assert(natural >= 10, `Only ${natural} games reached a four-pawn finish`);
});
