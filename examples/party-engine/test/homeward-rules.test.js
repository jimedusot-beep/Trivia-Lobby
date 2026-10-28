import test from "node:test";
import assert from "node:assert/strict";
import {
  createHomewardBoard,
  freshHomewardDeck,
  drawHomewardCard,
  legalHomewardMoves,
  simulateHomewardMove,
  applyHomewardMove,
  homewardPassAllowed,
  homewardProgress,
} from "../open-pack/homeward-rules.js";
import { entryFor, gateFor } from "../public/homeward-geometry.js";
function game(card = "1", count = 2) {
  const board = createHomewardBoard(
    Array.from({ length: count }, (_, i) => `p${i}`),
    1000,
  );
  board.turn = 0;
  board.stage = "choose";
  board.card = card;
  for (const seat of board.seats)
    seat.pawns = seat.pawns.map(() => ({ zone: "start", position: null }));
  return board;
}
function put(board, seat, pawn, zone, position = null) {
  board.seats[seat].pawns[pawn] = { zone, position };
}
function move(board, id) {
  const value = legalHomewardMoves(board).find((m) => m.id === id);
  assert(value, `Missing legal move ${id}`);
  applyHomewardMove(board, value);
  return value;
}
test("original setup has four labeled pawns, opposite two-player colors and a conserved 45-card deck", () => {
  const board = createHomewardBoard(["one", "two"], 1000);
  assert.deepEqual(
    board.seats.map((s) => s.color),
    [0, 2],
  );
  for (const seat of board.seats) {
    assert.equal(seat.pawns.length, 4);
    assert.deepEqual(seat.pawns[0], {
      zone: "track",
      position: entryFor(seat.color),
    });
    assert.equal(seat.pawns.filter((p) => p.zone === "start").length, 3);
  }
  assert.equal(freshHomewardDeck().length, 45);
  assert.equal(freshHomewardDeck().filter((c) => c === "1").length, 5);
  assert.equal(board.deck.length, 45);
  const card = drawHomewardCard(board);
  assert.equal(typeof card, "string");
  assert.equal(board.deck.length, 44);
  assert.throws(() => drawHomewardCard(board), /already active/);
});
test("only one/two can launch; own entry blocks a launch and an opponent can be bumped", () => {
  for (const card of ["1", "2"]) {
    const b = game(card);
    put(b, 0, 0, "track", 0);
    assert(!legalHomewardMoves(b).some((m) => m.kind === "launch"));
    put(b, 0, 0, "start");
    put(b, 1, 0, "track", 0);
    move(b, "launch:1");
    assert.deepEqual(b.seats[0].pawns[1], { zone: "track", position: 0 });
    assert.equal(b.seats[1].pawns[0].zone, "start");
  }
  for (const card of ["3", "4", "5", "7", "8", "10", "11", "12"]) {
    const b = game(card);
    assert.equal(legalHomewardMoves(b).length, 0);
  }
});
test("number cards, a reverse four and both ten choices follow their own card rules", () => {
  for (const [card, distance] of [
    ["1", 1],
    ["2", 2],
    ["3", 3],
    ["5", 5],
    ["7", 7],
    ["8", 8],
    ["11", 11],
    ["12", 12],
  ]) {
    const b = game(card);
    put(b, 0, 0, "track", 0);
    const option = move(b, `step:0:${distance}`);
    assert.equal(option.kind, "step");
    assert.equal(b.seats[0].pawns[0].position, distance);
  }
  const b = game("4");
  put(b, 0, 0, "track", 1);
  move(b, "step:0:-4");
  assert.equal(b.seats[0].pawns[0].position, 45);
  b.card = "3";
  move(b, "step:0:3");
  assert.deepEqual(b.seats[0].pawns[0], { zone: "safe", position: 1 });
  for (const distance of [10, -1]) {
    const t = game("10");
    put(t, 0, 0, "track", 1);
    assert(legalHomewardMoves(t).some((m) => m.id === `step:0:${distance}`));
  }
  const before = structuredClone(b);
  assert.equal(
    simulateHomewardMove(b, { kind: "step", pawn: 0, steps: 12 }),
    null,
  );
  assert.deepEqual(b, before);
});
test("home entry is exact, safe lanes can be exited backward and home pawns never move", () => {
  const b = game("1");
  put(b, 0, 0, "safe", 4);
  move(b, "step:0:1");
  assert.equal(b.seats[0].pawns[0].zone, "home");
  assert(!legalHomewardMoves(b).some((m) => m.pawn === 0));
  const over = game("2");
  put(over, 0, 0, "safe", 4);
  assert(!legalHomewardMoves(over).some((m) => m.id === "step:0:2"));
  const back = game("10");
  put(back, 0, 0, "safe", 0);
  move(back, "step:0:-1");
  assert.deepEqual(back.seats[0].pawns[0], {
    zone: "track",
    position: gateFor(0),
  });
  const safe = game("4");
  put(safe, 0, 0, "safe", 4);
  move(safe, "step:0:-4");
  assert.deepEqual(safe.seats[0].pawns[0], { zone: "safe", position: 0 });
});
test("ordinary landings cannot stack own pawns but can jump over them and capture an opponent", () => {
  const b = game("3");
  put(b, 0, 0, "track", 0);
  put(b, 0, 1, "track", 1);
  put(b, 1, 0, "track", 3);
  move(b, "step:0:3");
  assert.equal(b.seats[0].pawns[0].position, 3);
  assert.equal(b.seats[1].pawns[0].zone, "start");
  b.card = "1";
  put(b, 0, 2, "track", 4);
  const before = structuredClone(b);
  assert.equal(
    simulateHomewardMove(b, { kind: "step", pawn: 0, steps: 1 }),
    null,
  );
  assert.deepEqual(b, before);
  const s = game("1");
  put(s, 0, 0, "safe", 0);
  put(s, 0, 1, "safe", 1);
  assert(!legalHomewardMoves(s).some((m) => m.id === "step:0:1"));
});
test("foreign slides sweep their full path including own pawns; own slides stay still", () => {
  const b = game("1");
  put(b, 0, 0, "track", 13);
  put(b, 0, 1, "track", 16);
  put(b, 0, 2, "track", 14);
  put(b, 1, 0, "track", 15);
  put(b, 1, 1, "track", 17);
  const option = move(b, "step:0:1");
  assert.equal(option.bumps, 4);
  assert.equal(option.slides, 1);
  assert.equal(b.seats[0].pawns[0].position, 17);
  for (const [s, p] of [
    [0, 1],
    [0, 2],
    [1, 0],
    [1, 1],
  ])
    assert.equal(b.seats[s].pawns[p].zone, "start");
  const own = game("1");
  put(own, 0, 0, "track", 1);
  assert.equal(move(own, "step:0:1").slides, 0);
  assert.equal(own.seats[0].pawns[0].position, 2);
});
test("split seven spends both positive legs atomically, including home entry and order effects", () => {
  const b = game("7");
  put(b, 0, 0, "safe", 4);
  put(b, 0, 1, "track", 4);
  move(b, "split:0:1:1");
  assert.equal(b.seats[0].pawns[0].zone, "home");
  assert.equal(b.seats[0].pawns[1].position, 10);
  const order = game("7");
  put(order, 0, 0, "track", 13);
  put(order, 0, 1, "track", 16);
  const before = structuredClone(order);
  assert.equal(
    simulateHomewardMove(order, {
      kind: "split",
      pawn: 0,
      secondPawn: 1,
      firstSteps: 1,
    }),
    null,
  );
  assert.deepEqual(order, before);
  assert(legalHomewardMoves(order).some((m) => m.id === "split:1:0:6"));
  move(order, "split:1:0:6");
  assert.equal(order.seats[0].pawns[0].position, 17);
  assert.equal(order.seats[0].pawns[1].position, 22);
  assert.equal(
    simulateHomewardMove(game("7"), {
      kind: "split",
      pawn: 0,
      secondPawn: 0,
      firstSteps: 3,
    }),
    null,
  );
});
test("eleven swaps only track pawns, activates only the acting pawn's slide and permits optional decline", () => {
  const b = game("11");
  put(b, 0, 0, "track", 2);
  put(b, 1, 0, "track", 24);
  put(b, 1, 1, "safe", 0);
  assert(
    !legalHomewardMoves(b).some((m) => m.kind === "swap" && m.targetPawn === 1),
  );
  move(b, "swap:0:1:0");
  assert.equal(b.seats[0].pawns[0].position, 24);
  assert.equal(b.seats[1].pawns[0].position, 2);
  const slide = game("11");
  put(slide, 0, 0, "track", 0);
  put(slide, 1, 0, "track", 14);
  move(slide, "swap:0:1:0");
  assert.equal(slide.seats[0].pawns[0].position, 17);
  const optional = game("11");
  put(optional, 0, 0, "track", 46);
  put(optional, 1, 0, "track", 24);
  assert.equal(homewardPassAllowed(optional), true);
  put(optional, 0, 0, "track", 0);
  assert.equal(homewardPassAllowed(optional), false);
});
test("Bump requires Start and an opposing track pawn, with a slide resolved after the capture", () => {
  const b = game("BUMP");
  put(b, 1, 0, "track", 14);
  put(b, 1, 1, "safe", 0);
  put(b, 0, 1, "track", 1);
  assert(
    !legalHomewardMoves(b).some((m) => m.pawn === 1 || m.targetPawn === 1),
  );
  const m = move(b, "bump:0:1:0");
  assert.equal(b.seats[1].pawns[0].zone, "start");
  assert.equal(b.seats[0].pawns[0].position, 17);
  assert.equal(m.slides, 1);
  assert.equal(legalHomewardMoves(game("BUMP")).length, 0);
});
test("draw reshuffles only discards and progress awards ignore unhomed track pawns", () => {
  const b = createHomewardBoard(["a", "b"], 1000);
  b.deck = [];
  b.discards = freshHomewardDeck();
  const card = drawHomewardCard(b);
  assert.equal(b.deck.length, 44);
  assert.equal(b.discards.length, 0);
  assert.equal([...b.deck, card].length, 45);
  const seat = b.seats[0];
  seat.pawns = [
    { zone: "home", position: null },
    { zone: "home", position: null },
    { zone: "safe", position: 2 },
    { zone: "track", position: 46 },
  ];
  assert.equal(homewardProgress(seat), 45);
});
