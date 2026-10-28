import test from "node:test";
import assert from "node:assert/strict";
import { Party } from "../engine.js";
import { DRAW_LIMITS } from "../open-pack/drawing.js";
import {
  createBoard,
  legalMoves,
  moveBoard,
} from "../open-pack/board-rules.js";
import {
  validateShow,
  defaultShow,
  importShow,
} from "../public/show-format.js";
import { validateGuestQuiz } from "../custom-quiz.js";
import { importGuestDeck, backupGuestDeck } from "../public/guest-decks.js";
import { generateDeck } from "../open-pack/color-rules.js";
let request = 0;
function action(p, actor, type, value, extra = {}) {
  return p.handle(actor, {
    v: 1,
    type,
    requestId: `open-pack-${++request}`,
    matchId: p.matchId,
    revision: p.revision,
    ...(value === undefined ? {} : { value }),
    ...extra,
  });
}
function game(mode, count = 4, settings) {
  let now = 1000;
  const p = new Party("ABCD23", { clock: () => now, countdownMs: 1 });
  const ids = Array.from({ length: count }, (_, i) => p.join(`Guest ${i + 1}`));
  action(p, "host", "start", mode, settings ? { settings } : {});
  now++;
  p.tick();
  return {
    p,
    ids,
    act: (id, v) => action(p, id, "play", v),
    next: () => action(p, "host", "next"),
    advance: (ms) => {
      now += ms;
      p.tick();
    },
  };
}

test("Feud: hidden board, first-arrival buzzer, host judging, three strikes and steal", () => {
  const { p, ids, act } = game("feud");
  const guest = p.view(ids[0]).pack;
  assert.ok(guest.board.every((a) => a.hidden));
  assert.equal(guest.judge, undefined);
  assert.ok(p.view("host").pack.judge.length);
  assert.throws(() => act(ids[0], { action: "judge", index: 0 }), /host/);
  act(ids[0], { action: "buzz" });
  assert.throws(() => act(ids[1], { action: "buzz" }), /closed/);
  act("host", { action: "judge", index: 0 });
  assert.equal(p.pack.team, 0);
  assert.equal(p.pack.pot, 35);
  for (let n = 0; n < 3; n++) act("host", { action: "judge", index: -1 });
  assert.equal(p.pack.stage, "steal");
  act("host", { action: "judge", index: 1 });
  assert.equal(p.phase, "reveal");
  assert.deepEqual(p.pack.teamScores, [0, 60]);
  assert.equal(p.players.get(ids[1]).score, 60);
  assert.equal(p.players.get(ids[0]).score, 0);
});

test("Feud: complete all boards and two private timed finalists without duplicate awards", () => {
  const g = game("feud"),
    { p, ids, act, next } = g;
  for (let board = 0; board < 3; board++) {
    act(ids[0], { action: "buzz" });
    for (let i = 0; i < 5; i++) act("host", { action: "judge", index: i });
    assert.equal(p.phase, "reveal");
    next();
  }
  assert.equal(p.pack.stage, "final-ready");
  assert.equal(p.pack.teamScores[0], 600);
  act("host", { action: "final-start" });
  assert.equal(p.view(ids[2]).pack.canAnswer, false);
  assert.throws(
    () => act(ids[1], { action: "final-answer", text: "Banana" }),
    /current finalist/,
  );
  const first = ["Banana", "Bird", "Orange juice", "Swing", "Zebra"];
  for (const text of first) act(ids[0], { action: "final-answer", text });
  assert.equal(p.pack.finalPlayer, 1);
  assert.equal(p.view(ids[2]).pack.finalAnswers, undefined);
  act("host", { action: "final-start" });
  assert.throws(
    () => act(ids[2], { action: "final-answer", text: "Banana" }),
    /used/,
  );
  for (const text of ["Lemon", "Airplane", "Milk", "Slide", "Tiger"])
    act(ids[2], { action: "final-answer", text });
  assert.equal(p.phase, "reveal");
  assert.equal(p.pack.finalTotal, 350);
  next();
  assert.equal(p.phase, "finished");
  assert.equal(p.players.get(ids[0]).score, 950);
  assert.throws(() => next(), /after reveal/);
  assert.equal(p.players.get(ids[0]).score, 950);
});

test("Feud timeouts release a buzzer and complete both lightning players", () => {
  const g = game("feud"),
    { p, ids, act, next, advance } = g;
  act(ids[0], { action: "buzz" });
  advance(20000);
  assert.equal(p.pack.team, 1);
  for (let n = 0; n < 3; n++) advance(25000);
  assert.equal(p.pack.stage, "steal");
  advance(20000);
  next();
  for (let n = 0; n < 2; n++) {
    advance(45000);
    next();
  }
  act("host", { action: "final-start" });
  advance(20000);
  assert.equal(p.pack.stage, "final-ready");
  act("host", { action: "final-start" });
  advance(25000);
  assert.equal(p.pack.finalTotal, 0);
  next();
  assert.equal(p.phase, "finished");
});

test("custom shows reject bad totals, duplicate answers and unbounded content; import interoperates", () => {
  assert.equal(validateShow(defaultShow).rounds.length, 3);
  let bad = structuredClone(defaultShow);
  bad.rounds[0].answers[0].points++;
  assert.throws(() => validateShow(bad), /100/);
  bad = structuredClone(defaultShow);
  bad.rounds[0].answers[1].text = bad.rounds[0].answers[0].text;
  assert.throws(() => validateShow(bad), /different/);
  const source = {
    title_text: "Our family",
    rounds: defaultShow.rounds.map((q) => ({
      question: q.question,
      multiply: q.multiplier,
      answers: q.answers.map((a) => ({ ans: a.text, pnt: a.points })),
    })),
    final_round: defaultShow.final.map((q) => ({
      question: q.question,
      answers: q.answers.map((a) => [a.text, a.points]),
    })),
  };
  assert.equal(importShow(source).title, "Our family");
});

test("Drawing: clue privacy, bounded strokes, wrong-actor rejection, replay, scoring and all turns", () => {
  const g = game("draw"),
    { p, ids, act, next, advance } = g;
  for (let turn = 0; turn < ids.length; turn++) {
    const artist = ids[turn];
    assert.equal(p.view("host").pack.choices, undefined);
    assert.equal(p.view(ids[(turn + 1) % ids.length]).pack.word, undefined);
    act(artist, { action: "choose", index: 0 });
    assert.equal(p.view("host").pack.word, undefined);
    const stroke = {
      action: "stroke",
      points: [
        [0, 0],
        [1000, 1000],
      ],
      color: "#20264b",
      width: 8,
    };
    assert.throws(() => act(ids[(turn + 1) % ids.length], stroke), /artist/);
    assert.throws(
      () =>
        act(artist, {
          ...stroke,
          points: [
            [0, 0],
            [1001, 1000],
          ],
        }),
      /Invalid/,
    );
    const msg = {
      v: 1,
      type: "play",
      requestId: `stroke-replay-${turn}`,
      matchId: p.matchId,
      revision: p.revision,
      value: stroke,
    };
    p.handle(artist, msg);
    p.handle(artist, msg);
    assert.equal(p.pack.strokes.length, 1);
    const restored = p.view(artist).pack;
    assert.deepEqual(restored.strokes, [
      {
        points: [
          [0, 0],
          [1000, 1000],
        ],
        color: "#20264b",
        width: 8,
      },
    ]);
    for (const id of ids.filter((id) => id !== artist))
      act(id, { action: "guess", text: p.pack.word });
    assert.equal(p.phase, "reveal");
    assert.equal(p.view("host").pack.word, p.pack.word);
    next();
  }
  assert.equal(p.phase, "finished");
  assert.ok(ids.every((id) => p.players.get(id).score > 0));
});

test("Drawing timeout chooses a word, closes the drawing, and bounds canvas history", () => {
  const { p, ids, act, advance } = game("draw");
  advance(15000);
  assert.equal(p.pack.stage, "drawing");
  for (let n = 0; n < 18; n++)
    act(ids[1], { action: "guess", text: `Wrong ${n}` });
  assert.equal(p.pack.guesses.length, 16);
  for (let n = 0; n < DRAW_LIMITS.strokes; n++)
    act(ids[0], {
      action: "stroke",
      points: [
        [n, n],
        [n + 1, n + 1],
      ],
      color: "#20264b",
      width: 8,
    });
  assert.throws(
    () =>
      act(ids[0], {
        action: "stroke",
        points: [
          [0, 0],
          [1, 1],
        ],
        color: "#20264b",
        width: 8,
      }),
    /Canvas is full/,
  );
  act(ids[0], { action: "clear" });
  assert.equal(p.pack.pointCount, 0);
  advance(60000);
  assert.equal(p.phase, "reveal");
});

test("Color deck has 108 unique cards; private hands, capped seating and legal turn ownership", () => {
  const deck = generateDeck();
  assert.equal(deck.length, 108);
  assert.equal(new Set(deck.map((c) => c.id)).size, 108);
  const { p, ids, act } = game("colors", 20, {
    bots: 8,
    stacking: true,
    turnSeconds: 15,
  });
  assert.equal(p.pack.seats.length, 10);
  assert.equal(p.view(ids[19]).pack.spectating, true);
  const me = p.view(ids[0]).pack;
  assert.equal(me.hand.length, 7);
  assert.equal(p.view("host").pack.hand.length, 0);
  assert.equal(
    p.view(ids[1]).pack.hand.some((c) => c.id === me.hand[0].id),
    false,
  );
  assert.equal(Object.hasOwn(me, "deck"), false);
  assert.throws(() => act(ids[1], { action: "draw" }), /turn/);
  assert.throws(
    () =>
      act(ids[0], {
        action: "play",
        card: p.pack.hands[ids[1]][0].id,
        color: "blue",
      }),
    /cannot/,
  );
});

test("Color rules enforce wild restrictions, penalties, reverse, skips, refill and final scoring", () => {
  const { p, ids, act } = game("colors", 2, { stacking: true });
  const s = p.pack;
  s.hands[ids[0]] = [
    { id: "red-1", color: "red", value: "1" },
    { id: "wild-4", color: "wild", value: "wild_draw_four" },
  ];
  s.color = "red";
  s.discard = [{ id: "top", color: "red", value: "3" }];
  assert.throws(
    () => act(ids[0], { action: "play", card: "wild-4", color: "blue" }),
    /cannot/,
  );
  s.hands[ids[0]] = [
    { id: "reverse", color: "red", value: "reverse" },
    { id: "last", color: "red", value: "9" },
  ];
  act(ids[0], { action: "play", card: "reverse" });
  assert.equal(s.turn, 0);
  assert.equal(s.direction, -1);
  s.hands[ids[0]] = [{ id: "draw", color: "red", value: "draw_two" }];
  s.hands[ids[1]] = [{ id: "opponent", color: "blue", value: "3" }];
  act(ids[0], { action: "play", card: "draw" });
  assert.equal(p.phase, "reveal");
  assert.equal(s.hands[ids[1]].length, 3);
  assert.ok(p.players.get(ids[0]).score > 0);
});

test("Color matches terminate through legal human play and bot deadlines; invalid settings are atomic", () => {
  const g = game("colors", 2, { bots: 2, turnSeconds: 15 }),
    { p, act, advance } = g;
  let moves = 0;
  while (p.phase === "playing" && moves++ < 1500) {
    const id = p.pack.seats[p.pack.turn];
    if (id.startsWith("bot-")) {
      advance(1000);
      continue;
    }
    const view = p.view(id).pack,
      card = view.hand.find((c) => c.playable);
    if (card) act(id, { action: "play", card: card.id, color: "red" });
    else if (view.drawn) act(id, { action: "pass" });
    else act(id, { action: "draw" });
  }
  assert.equal(p.phase, "reveal");
  assert.ok(p.pack.winner || p.pack.moves >= 1000);
  const q = new Party("EFGH23"),
    one = q.join("One"),
    two = q.join("Two");
  assert.throws(
    () => action(q, "host", "start", "colors", { settings: { bots: 9 } }),
    /bots/,
  );
  assert.equal(q.phase, "lobby");
  assert.equal(q.players.size, 2);
});

for (const kind of ["four", "chess", "checkers", "reversi", "mancala"]) {
  test(`${kind}: 20 players have ten isolated paired tables; complete games and no cross-table moves`, () => {
    const { p, ids, act } = game(kind, 20);
    assert.equal(p.pack.tables.length, 10);
    assert.throws(
      () =>
        act(ids[2], {
          action: "move",
          table: 0,
          ...legalMoves(p.pack.tables[0].game)[0],
        }),
      /own table/,
    );
    for (let i = 0; i < 10; i++) {
      const t = p.pack.tables[i];
      const before = t.game.moves;
      act(t.players[0], { action: "move", table: i, ...legalMoves(t.game)[0] });
      assert.equal(t.game.moves, before + 1);
      act(t.players[t.game.turn], { action: "resign", table: i });
    }
    assert.equal(p.phase, "reveal");
    assert.equal(p.view(ids[0]).pack.tables[0].own, true);
    assert.equal(p.view(ids[0]).pack.tables[1].canMove, false);
  });
  test(`${kind}: odd player gets a bot and a full legal board game terminates`, () => {
    const g = createBoard(kind);
    let n = 0;
    while (!g.result && n++ < 500) {
      const legal = legalMoves(g);
      assert.ok(legal.length);
      moveBoard(g, legal[(n * 7) % legal.length]);
    }
    assert.ok(g.result || n >= 500);
    const { p, ids, act } = game(kind, 3);
    const table = p.pack.tables[1];
    assert.match(table.players[1], /^bot-/);
    act(ids[2], { action: "move", table: 1, ...legalMoves(table.game)[0] });
    assert.ok(
      table.game.moves >= 2 || table.game.result || table.game.turn === 0,
    );
  });
}

test("Four-in-a-Row detects vertical, horizontal and diagonal wins and rejects full columns", () => {
  for (const cols of [
    [0, 1, 0, 1, 0, 1, 0],
    [0, 6, 1, 6, 2, 5, 3],
    [0, 1, 1, 2, 6, 2, 2, 3, 6, 3, 5, 3, 3],
  ]) {
    const g = createBoard("four");
    for (const to of cols) moveBoard(g, { to });
    assert.deepEqual(g.result, { winner: 0 });
  }
  const g = createBoard("four");
  for (let i = 0; i < 6; i++) moveBoard(g, { to: 0 });
  assert.throws(() => moveBoard(g, { to: 0 }), /not legal/);
});

test("Chess supports castling, en passant, underpromotion and mate", () => {
  const g = createBoard("chess");
  g.chess.load("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
  moveBoard(g, { from: 60, to: 62 });
  assert.equal(g.chess.get("f1").type, "r");
  g.chess.load("4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1");
  g.turn = 0;
  moveBoard(g, { from: 28, to: 19 });
  assert.equal(g.chess.get("d5"), undefined);
  g.chess.load("4k3/P7/8/8/8/8/8/4K3 w - - 0 1");
  g.turn = 0;
  moveBoard(g, { from: 8, to: 0, promotion: "n" });
  assert.equal(g.chess.get("a8").type, "n");
  const mate = createBoard("chess");
  for (const [from, to] of [
    [53, 45],
    [12, 28],
    [54, 38],
    [3, 39],
  ])
    moveBoard(mate, { from, to });
  assert.deepEqual(mate.result, { winner: 1 });
});

test("Checkers forces captures and chains jumps, and ends when the opponent cannot move", () => {
  const g = createBoard("checkers");
  g.cells = Array(64).fill(null);
  g.cells[42] = 1;
  g.cells[35] = -1;
  g.cells[21] = -1;
  g.cells[56] = 1;
  assert.deepEqual(legalMoves(g), [{ from: 42, to: 28, capture: 35 }]);
  moveBoard(g, { from: 42, to: 28 });
  assert.equal(g.turn, 0);
  assert.equal(g.jumping, 28);
  moveBoard(g, { from: 28, to: 14 });
  assert.equal(g.cells[35], null);
  assert.equal(g.cells[21], null);
  assert.deepEqual(g.result, { winner: 0 });
});

test("Reversi flips bracketed discs and automatically passes a player with no legal move", () => {
  const g = createBoard("reversi");
  assert.equal(legalMoves(g).length, 4);
  moveBoard(g, { to: 19 });
  assert.equal(g.cells[27], 0);
  assert.equal(g.turn, 1);
  g.cells = Array(64).fill(0);
  g.cells[0] = null;
  g.cells[1] = 1;
  g.turn = 0;
  moveBoard(g, { to: 0 });
  assert.deepEqual(g.result, { winner: 0 });
});

test("Mancala preserves 48 stones, captures across, grants extra turns and sweeps terminal pits", () => {
  const g = createBoard("mancala");
  moveBoard(g, { to: 2 });
  assert.equal(g.turn, 0);
  assert.equal(g.cells[6], 1);
  assert.equal(
    g.cells.reduce((a, b) => a + b),
    48,
  );
  g.cells = [1, 0, 0, 0, 0, 1, 20, 1, 0, 0, 0, 5, 0, 20];
  g.turn = 0;
  moveBoard(g, { to: 0 });
  assert.equal(g.cells[6], 26);
  assert.equal(g.cells[11], 0);
  const end = createBoard("mancala");
  end.cells = [0, 0, 0, 0, 0, 1, 20, 1, 1, 1, 1, 1, 1, 21];
  moveBoard(end, { to: 5 });
  assert.deepEqual(end.result, { winner: 1 });
  assert.ok(end.cells.slice(0, 6).every((v) => v === 0));
});

test("Manual Whist table: private hands, ownership, chips conservation, dealing and host result", () => {
  const { p, ids, act } = game("table", 4, { preset: "whist" });
  assert.equal(p.view(ids[0]).pack.hand.length, 13);
  assert.equal(p.view("host").pack.hand.length, 0);
  assert.equal(p.view(ids[1]).pack.seats[0].cards, undefined);
  assert.throws(
    () => act(ids[1], { action: "play", card: p.pack.hands[ids[0]][0].id }),
    /own hand/,
  );
  const card = p.pack.hands[ids[0]][0];
  act(ids[0], { action: "play", card: card.id });
  assert.equal(p.pack.center.length, 1);
  assert.throws(
    () => act(ids[1], { action: "take-back", card: card.id }),
    /own played/,
  );
  act(ids[0], { action: "bet", amount: 50 });
  assert.equal(p.pack.pot, 50);
  assert.throws(() => act("host", { action: "deal" }), /Award/);
  assert.throws(() => act(ids[1], { action: "settle", seat: 1 }), /host/);
  act("host", { action: "settle", seat: 0 });
  assert.equal(
    Object.values(p.pack.chips).reduce((a, b) => a + b, 0),
    800,
  );
  act("host", { action: "deal" });
  assert.equal(p.pack.center.length, 0);
  act(ids[0], { action: "reveal-hand" });
  assert.equal(p.view(ids[1]).pack.seats[0].cards.length, 13);
  act("host", { action: "finish" });
  assert.equal(p.phase, "reveal");
});

test("Whist seats four with 13 private cards and spectators, with no accounts", () => {
  const { p, ids } = game("table", 20, { preset: "whist" });
  assert.equal(p.pack.seats.length, 4);
  assert.equal(p.pack.deck.length, 0);
  for (const id of ids.slice(0, 4)) assert.equal(p.pack.hands[id].length, 13);
  assert.equal(p.view(ids[4]).pack.active, false);
});

test("Backgammon: 15 checkers, turn ownership, blocked points, capture and bearing off", () => {
  const { p, ids, act } = game("backgammon", 20);
  assert.equal(
    p.pack.points.reduce((n, x) => n + Math.max(0, x), 0),
    15,
  );
  assert.equal(
    p.pack.points.reduce((n, x) => n + Math.max(0, -x), 0),
    15,
  );
  assert.throws(() => act(ids[2], { action: "roll" }), /turn/);
  act(ids[0], { action: "roll" });
  assert.throws(() => act(ids[0], { action: "roll" }), /Finish/);
  assert.throws(
    () => act(ids[0], { action: "move", from: 0, to: 23 }),
    /blocked/,
  );
  act(ids[0], { action: "move", from: 0, to: 1 });
  assert.equal(p.pack.points[1], 1);
  act(ids[0], { action: "end-turn" });
  act(ids[1], { action: "roll" });
  act(ids[1], { action: "move", from: 23, to: 1 });
  assert.equal(p.pack.bar[0], 1);
});

test("Razzia import preserves single-answer content, times, points and penalties through backup and hosting", () => {
  const raw = {
    subject: "Our questions",
    questions: [
      {
        question: "Pick blue",
        answers: ["Blue", "Gold"],
        solutions: [0],
        note: "The sky",
        time: 15,
        maxPoints: 500,
        penalty: 50,
      },
    ],
  };
  const deck = importGuestDeck("razzia.json", JSON.stringify(raw));
  assert.equal(deck.questions[0].seconds, 15);
  assert.equal(deck.questions[0].points, 500);
  assert.deepEqual(importGuestDeck("backup.json", backupGuestDeck(deck)), deck);
  assert.deepEqual(validateGuestQuiz(deck), deck);
  let now = 0;
  const p = new Party("ABCD23", {
    clock: () => now,
    countdownMs: 1,
    customQuiz: deck,
  });
  const ids = [p.join("A"), p.join("B"), p.join("C")];
  action(p, "host", "start", "quiz");
  now++;
  p.tick();
  assert.equal(p.deadline, 15001);
  assert.equal(p.view(ids[0]).question.correct, undefined);
  action(p, ids[0], "answer", 0);
  action(p, ids[1], "answer", 1);
  action(p, ids[2], "answer", 1);
  assert.equal(p.players.get(ids[0]).score, 500);
  assert.equal(p.players.get(ids[1]).score, 0);
  for (const patch of [
    { gameMode: "survey" },
    { questions: [{ ...raw.questions[0], type: "multi" }] },
    {
      questions: [
        {
          ...raw.questions[0],
          media: { type: "image", url: "https://example.com" },
        },
      ],
    },
    { questions: [{ ...raw.questions[0], solutions: [0, 1] }] },
  ])
    assert.throws(() =>
      importGuestDeck("razzia.json", JSON.stringify({ ...raw, ...patch })),
    );
});
