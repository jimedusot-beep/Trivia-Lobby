import test from "node:test";
import assert from "node:assert/strict";
import { Party } from "../engine.js";
import { rankHand, compareRanks, POKER_RULES } from "../open-pack/poker.js";
import { snapshotParty, restoreParty } from "../party-checkpoint.js";
let request = 0;
const cards = (text) =>
  text
    .split(" ")
    .map((v, i) => ({
      id: `fixture-${i}-${v}`,
      rank: v.slice(0, -1),
      suit: v.slice(-1),
    }));
function game(count = 3) {
  let now = 1000;
  const p = new Party("ABC234", { clock: () => now, countdownMs: 1 });
  const ids = Array.from({ length: count }, (_, i) => p.join(`Player ${i}`));
  const act = (actor, value) =>
    p.handle(actor, {
      v: 1,
      type: "play",
      requestId: `poker-test-${++request}`,
      matchId: p.matchId,
      revision: p.revision,
      value,
    });
  p.handle("host", {
    v: 1,
    type: "start",
    requestId: `poker-start-${++request}`,
    matchId: null,
    revision: 0,
    value: "table",
  });
  now++;
  p.tick();
  return {
    p,
    ids,
    act,
    advance: (ms) => {
      now += ms;
      p.tick();
    },
    now: () => now,
  };
}
function closeHand(g) {
  let moves = 0;
  while (
    g.p.phase === "playing" &&
    g.p.pack.stage !== "showdown" &&
    moves++ < 100
  ) {
    const s = g.p.pack,
      id = s.turn;
    g.act(
      id,
      s.stage === "draw"
        ? { action: "discard", cards: [] }
        : { action: s.currentBet > s.roundPaid[id] ? "call" : "check" },
    );
  }
  assert(moves < 100, "Hand must terminate");
}
const total = (s) => Object.values(s.chips).reduce((a, b) => a + b, 0) + s.pot;
test("five-card ranking handles every category, ace-low straights, kickers and exact ties", () => {
  const ordered = [
    "A♠ J♥ 9♦ 7♣ 3♠",
    "2♠ 2♥ A♦ K♣ Q♠",
    "3♠ 3♥ 2♦ 2♣ A♠",
    "4♠ 4♥ 4♦ A♣ K♠",
    "5♠ 6♥ 7♦ 8♣ 9♠",
    "2♠ 5♠ 7♠ 9♠ J♠",
    "8♠ 8♥ 8♦ 2♣ 2♠",
    "9♠ 9♥ 9♦ 9♣ A♠",
    "3♠ 4♠ 5♠ 6♠ 7♠",
  ];
  ordered.forEach((hand, i) => assert.equal(rankHand(cards(hand)).score[0], i));
  for (let i = 1; i < ordered.length; i++)
    assert(
      compareRanks(
        rankHand(cards(ordered[i])).score,
        rankHand(cards(ordered[i - 1])).score,
      ) > 0,
    );
  assert.deepEqual(rankHand(cards("A♠ 2♥ 3♦ 4♣ 5♠")).score, [4, 5]);
  assert.equal(rankHand(cards("10♠ J♠ Q♠ K♠ A♠")).name, "Royal flush");
  assert(
    compareRanks(
      rankHand(cards("K♠ K♥ A♦ 8♣ 2♠")).score,
      rankHand(cards("K♦ K♣ Q♦ J♣ 9♠")).score,
    ) > 0,
  );
  assert.equal(
    compareRanks(
      rankHand(cards("A♠ A♥ K♦ Q♣ 9♠")).score,
      rankHand(cards("A♦ A♣ K♠ Q♥ 9♦")).score,
    ),
    0,
  );
  assert.throws(() => rankHand(cards("A♠ A♠ K♦ Q♣ 9♠")), /Invalid/);
});
test("guided poker uses private five-card hands, six seats and an explicit clockwise turn", () => {
  const g = game(20),
    s = g.p.pack;
  assert.equal(s.guided, true);
  assert.equal(s.seats.length, 6);
  assert.equal(s.turn, g.ids[1]);
  assert.equal(total(s), 1200);
  assert.equal(s.pot, 30);
  for (const id of s.seats) assert.equal(g.p.view(id).pack.hand.length, 5);
  for (const id of ["host", g.ids[19]])
    assert.equal(g.p.view(id).pack.hand.length, 0);
  assert(
    g.p.view(g.ids[1]).pack.seats.every((seat) => seat.cards === undefined),
  );
  assert.throws(() => g.act(g.ids[0], { action: "check" }), /turn/);
  assert.throws(() => g.act("host", { action: "check" }), /joined/);
  assert.throws(() => g.act(g.ids[19], { action: "check" }), /turn/);
  assert.throws(() => g.act("host", { action: "settle", seat: 0 }), /fields/);
});
test("two betting rounds, one bounded card exchange, automatic results and five complete hands", () => {
  const g = game(2),
    s = g.p.pack;
  for (let n = 1; n <= 5; n++) {
    assert.equal(s.handNumber, n);
    const first = s.turn;
    g.act(first, { action: "bet" });
    assert.throws(() => g.act(s.turn, { action: "check" }), /Call/);
    g.act(s.turn, { action: "call" });
    assert.equal(s.stage, "draw");
    const artist = s.turn,
      old = [...s.hands[artist]];
    assert.throws(
      () => g.act(artist, { action: "discard", cards: [old[0].id, old[0].id] }),
      /different/,
    );
    assert.throws(
      () =>
        g.act(artist, {
          action: "discard",
          cards: old.slice(0, 4).map((c) => c.id),
        }),
      /three/,
    );
    assert.throws(
      () =>
        g.act(artist, {
          action: "discard",
          cards: [s.hands[s.handSeats.find((id) => id !== artist)][0].id],
        }),
      /own/,
    );
    g.act(artist, {
      action: "discard",
      cards: old.slice(0, 3).map((c) => c.id),
    });
    assert.equal(
      s.hands[artist].filter((c) => old.some((o) => o.id === c.id)).length,
      2,
    );
    g.act(s.turn, { action: "discard", cards: [] });
    assert.equal(s.stage, "bet2");
    closeHand(g);
    assert.equal(s.pot, 0);
    assert.equal(total(s), 400);
    assert(
      g.p.view("host").pack.seats.every((seat) => seat.cards?.length === 5),
    );
    if (n < 5) {
      assert.equal(s.stage, "showdown");
      g.act("host", { action: "deal" });
    }
  }
  assert.equal(g.p.phase, "reveal");
  const scored = [...g.p.players.values()].map((p) => p.score);
  g.p.tick();
  assert.deepEqual(
    [...g.p.players.values()].map((p) => p.score),
    scored,
  );
  assert(scored.some((n) => n === 100));
});
test("fold wins do not reveal private hands, and host cannot redeal during a live hand", () => {
  const g = game(2),
    s = g.p.pack;
  assert.throws(() => g.act("host", { action: "deal" }), /current hand/);
  g.act(s.turn, { action: "fold" });
  assert.equal(s.stage, "showdown");
  assert.equal(s.pot, 0);
  assert.equal(total(s), 400);
  assert(g.p.view("host").pack.seats.every((seat) => seat.cards === undefined));
  assert.throws(() => g.act(g.ids[0], { action: "deal" }), /host/);
  g.act("host", { action: "finish" });
  assert.equal(g.p.phase, "reveal");
});
test("short all-ins receive only their eligible side pots and chips are conserved", () => {
  const g = game(3),
    s = g.p.pack,
    [a, b, c] = g.ids;
  s.chips[a] = 5;
  s.chips[b] = 15;
  s.chips[c] = 195;
  s.hands[a] = cards("10♠ J♠ Q♠ K♠ A♠");
  s.hands[b] = cards("K♥ K♦ K♣ K♠ 2♦");
  s.hands[c] = cards("3♥ 3♦ 6♣ 8♠ J♦");
  const before = total(s);
  g.act(b, { action: "bet" });
  g.act(c, { action: "call" });
  g.act(a, { action: "call" });
  assert.equal(s.chips[a], 0);
  assert.equal(s.stage, "draw");
  while (s.stage === "draw") g.act(s.turn, { action: "discard", cards: [] });
  g.act(b, { action: "bet" });
  g.act(c, { action: "call" });
  assert.equal(s.stage, "showdown");
  assert.equal(s.payouts[a], 30);
  assert.equal(s.payouts[b], 20);
  assert.equal(s.payouts[c], 0);
  assert.equal(total(s), before);
  assert.equal(s.pot, 0);
});
test("tied pots split by rank, with odd chips clockwise after the dealer", () => {
  const g = game(3),
    s = g.p.pack,
    [a, b, c] = g.ids;
  s.hands[a] = cards("A♠ A♥ K♦ Q♣ 9♠");
  s.hands[b] = cards("A♦ A♣ K♠ Q♥ 9♦");
  s.hands[c] = cards("2♥ 3♦ 6♣ 8♠ J♦");
  closeHand(g);
  assert.equal(s.payouts[a], 7);
  assert.equal(s.payouts[b], 8);
  assert.equal(s.payouts[c], 0);
  assert.equal(total(s), 600);
});
test("short raises do not reopen prior raise rights and full betting increases are capped", () => {
  const g = game(3),
    s = g.p.pack,
    [a, b, c] = g.ids;
  s.chips[c] = 15;
  g.act(b, { action: "bet" });
  g.act(c, { action: "bet" });
  assert.equal(s.currentBet, 15);
  g.act(a, { action: "call" });
  assert.equal(s.turn, b);
  assert.equal(g.p.view(b).pack.actions.raise, 0);
  g.act(b, { action: "call" });
  assert.equal(s.stage, "draw");
  const h = game(2);
  for (let i = 0; i < POKER_RULES.increases; i++)
    h.act(h.p.pack.turn, { action: "bet" });
  assert.equal(h.p.view(h.p.pack.turn).pack.actions.raise, 0);
  assert.throws(() => h.act(h.p.pack.turn, { action: "bet" }), /Call/);
});
test("missed turns check, fold or stand pat; recovery keeps turn, cards, pot and pending actors", () => {
  const g = game(3),
    s = g.p.pack;
  const first = s.turn;
  g.advance(POKER_RULES.turnMs);
  assert.notEqual(s.turn, first);
  g.act(s.turn, { action: "bet" });
  const folding = s.turn;
  g.advance(POKER_RULES.turnMs);
  assert(s.folded.includes(folding));
  while (s.stage === "bet1") g.act(s.turn, { action: "call" });
  assert.equal(s.stage, "draw");
  const standing = s.turn;
  g.advance(POKER_RULES.turnMs);
  assert.equal(s.drawCounts[standing], 0);
  const restored = restoreParty(
    g.p.code,
    JSON.parse(JSON.stringify(snapshotParty(g.p))),
    { clock: g.now },
    g.now(),
  );
  assert(restored.pack.pending instanceof Set);
  assert(restored.pack.raiseRights instanceof Set);
  assert.equal(restored.pack.turn, s.turn);
  assert.deepEqual(restored.pack.hands, s.hands);
  assert.equal(restored.pack.pot, s.pot);
  assert.equal(restored.view("host").pack.hand.length, 0);
});
test("new request replays cannot pay twice, forged fields fail and an aborted hand refunds its pot", () => {
  const g = game(2),
    s = g.p.pack;
  const message = {
    v: 1,
    type: "play",
    requestId: "poker-idempotent-1",
    matchId: g.p.matchId,
    revision: g.p.revision,
    value: { action: "bet" },
  };
  const turn = s.turn;
  g.p.handle(turn, message);
  const pot = s.pot;
  g.p.handle(turn, message);
  assert.equal(s.pot, pot);
  assert.throws(() => g.act(s.turn, { action: "call", amount: 500 }), /fields/);
  const before = total(s);
  g.act("host", { action: "end-match" });
  assert.equal(s.pot, 0);
  assert.equal(total(s), before);
  assert.equal(g.p.phase, "finished");
});
test("varied 2–6 seat games terminate and conserve every chip through calls, raises, folds and draws", () => {
  let seed = 1741;
  const random = (n) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed % n;
  };
  for (let count = 2; count <= 6; count++)
    for (let run = 0; run < 25; run++) {
      const g = game(count),
        s = g.p.pack;
      let steps = 0;
      while (g.p.phase === "playing" && steps++ < 1000) {
        if (s.stage === "showdown") g.act("host", { action: "deal" });
        else if (s.stage === "draw")
          g.act(s.turn, {
            action: "discard",
            cards: s.hands[s.turn].slice(0, random(4)).map((c) => c.id),
          });
        else {
          const a = g.p.view(s.turn).pack.actions;
          g.act(s.turn, {
            action:
              a.raise && random(3) === 0
                ? "bet"
                : random(12) === 0
                  ? "fold"
                  : a.call
                    ? "call"
                    : "check",
          });
        }
        assert.equal(
          total(s),
          count * POKER_RULES.chips,
          `chip conservation, ${count} seats, run ${run}, move ${steps}`,
        );
        assert(
          Object.values(s.chips).every(
            (n) => Number.isSafeInteger(n) && n >= 0,
          ),
        );
      }
      assert(steps < 1000);
      assert.equal(g.p.phase, "reveal");
      assert.equal(s.pot, 0);
    }
});
test("incomplete or corrupted guided poker checkpoints reject instead of resetting chips", () => {
  const g = game(2);
  for (const change of [
    (s) => delete s.hands[g.ids[0]],
    (s) => s.chips[g.ids[0]]++,
    (s) => (s.turn = "outsider"),
    (s) => (s.pending = []),
  ]) {
    const saved = JSON.parse(JSON.stringify(snapshotParty(g.p)));
    change(saved.pack);
    assert.throws(
      () => restoreParty(g.p.code, saved, { clock: g.now }, g.now()),
      /poker recovery/,
    );
  }
});
