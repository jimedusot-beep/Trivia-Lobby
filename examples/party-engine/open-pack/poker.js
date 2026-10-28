// SPDX-License-Identifier: AGPL-3.0-or-later
// Original five-card draw engine. Play chips, two betting rounds, one draw.
import {
  shuffle,
  randomUUID,
  requireFields,
  integer,
  fail,
  hostOnly,
  playerOnly,
  renewed,
  award,
} from "./shared.js";

export const POKER_RULES = Object.freeze({
  seats: 6,
  chips: 200,
  ante: 5,
  increment: 10,
  increases: 4,
  draw: 3,
  hands: 5,
  turnMs: 45000,
});
const values = { A: 14, K: 13, Q: 12, J: 11 };
const labels = [
  "High card",
  "One pair",
  "Two pair",
  "Three of a kind",
  "Straight",
  "Flush",
  "Full house",
  "Four of a kind",
  "Straight flush",
];
export function rankHand(cards) {
  if (
    !Array.isArray(cards) ||
    cards.length !== 5 ||
    cards.some(
      (c) =>
        !c ||
        !["♠", "♥", "♦", "♣"].includes(c.suit) ||
        ![
          "A",
          "K",
          "Q",
          "J",
          "10",
          "9",
          "8",
          "7",
          "6",
          "5",
          "4",
          "3",
          "2",
        ].includes(c.rank),
    ) ||
    new Set(cards.map((c) => c.rank + c.suit)).size !== 5
  )
    fail("Invalid poker hand.");
  const ranks = cards
    .map((c) => values[c.rank] ?? Number(c.rank))
    .sort((a, b) => b - a);
  const groups = [...new Set(ranks)]
    .map((rank) => [ranks.filter((r) => r === rank).length, rank])
    .sort((a, b) => b[0] - a[0] || b[1] - a[1]);
  const flush = cards.every((c) => c.suit === cards[0].suit);
  const straight =
    groups.length === 5
      ? ranks[0] - ranks[4] === 4
        ? ranks[0]
        : ranks.join(",") === "14,5,4,3,2"
          ? 5
          : 0
      : 0;
  let score;
  if (straight && flush) score = [8, straight];
  else if (groups[0][0] === 4) score = [7, groups[0][1], groups[1][1]];
  else if (groups[0][0] === 3 && groups[1][0] === 2)
    score = [6, groups[0][1], groups[1][1]];
  else if (flush) score = [5, ...ranks];
  else if (straight) score = [4, straight];
  else if (groups[0][0] === 3) score = [3, ...groups.map((g) => g[1])];
  else if (groups[0][0] === 2 && groups[1][0] === 2)
    score = [2, ...groups.map((g) => g[1])];
  else if (groups[0][0] === 2) score = [1, ...groups.map((g) => g[1])];
  else score = [0, ...ranks];
  return {
    score,
    name: score[0] === 8 && score[1] === 14 ? "Royal flush" : labels[score[0]],
  };
}
export function compareRanks(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i++)
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) - (b[i] ?? 0);
  return 0;
}
const live = (s) => s.handSeats.filter((id) => !s.folded.includes(id));
const movable = (s) => live(s).filter((id) => s.chips[id] > 0);
const name = (p, id) => p.players.get(id)?.name ?? "Player";
function clockwise(s, from) {
  const index = s.seats.indexOf(from);
  return Array.from(
    { length: s.seats.length },
    (_, i) => s.seats[(index + i + 1) % s.seats.length],
  );
}
function pay(s, id, amount) {
  s.chips[id] -= amount;
  s.contributions[id] += amount;
  s.pot += amount;
}
function setTurn(p, after) {
  const s = p.pack;
  s.turn = clockwise(s, after).find((id) => s.pending.has(id)) ?? null;
  if (s.turn) renewed(p, POKER_RULES.turnMs);
}
export function finishPoker(p, abandon = false) {
  const s = p.pack;
  if (s.matchScored) return;
  if (abandon && s.pot) {
    for (const id of s.seats) s.chips[id] += s.contributions[id] ?? 0;
    s.pot = 0;
    s.note =
      "The unfinished hand was cancelled and its contributions returned.";
  }
  const high = Math.max(...Object.values(s.chips));
  for (const id of s.seats) if (s.chips[id] === high) award(p, id, 100);
  s.matchScored = true;
  s.stage = "complete";
  s.turn = null;
  p.enter("reveal");
}
function settle(p, byFold = false) {
  const s = p.pack,
    contenders = live(s),
    payouts = Object.fromEntries(s.seats.map((id) => [id, 0]));
  const rankings = Object.fromEntries(
    contenders.map((id) => [id, rankHand(s.hands[id])]),
  );
  const levels = [
    ...new Set(Object.values(s.contributions).filter((n) => n > 0)),
  ].sort((a, b) => a - b);
  const pots = [];
  let previous = 0;
  for (const level of levels) {
    const contributors = s.handSeats.filter(
      (id) => s.contributions[id] >= level,
    );
    const amount = (level - previous) * contributors.length;
    previous = level;
    let eligible = contenders.filter((id) => s.contributions[id] >= level);
    // A lone contributor receives their unmatched excess back, even after folding.
    if (contributors.length === 1) eligible = contributors;
    if (!eligible.length) {
      for (const id of contributors)
        payouts[id] += level - (levels[levels.indexOf(level) - 1] ?? 0);
      continue;
    }
    let winners = eligible;
    if (eligible.length > 1) {
      let best = rankings[eligible[0]].score;
      for (const id of eligible)
        if (compareRanks(rankings[id].score, best) > 0)
          best = rankings[id].score;
      winners = eligible.filter(
        (id) => compareRanks(rankings[id].score, best) === 0,
      );
    }
    const ordered = clockwise(s, s.dealer).filter((id) => winners.includes(id));
    const each = Math.floor(amount / winners.length),
      odd = amount % winners.length;
    ordered.forEach((id, i) => {
      payouts[id] += each + (i < odd ? 1 : 0);
    });
    pots.push({
      amount,
      winners: [...winners],
      refund: contributors.length === 1,
    });
  }
  for (const id of s.seats) s.chips[id] += payouts[id];
  s.lastPot = s.pot;
  s.pot = 0;
  s.payouts = payouts;
  s.pots = pots;
  s.showCards = !byFold;
  s.rankings = rankings;
  s.stage = "showdown";
  s.turn = null;
  s.pending = new Set();
  s.note = byFold
    ? `${name(p, contenders[0])} wins after everyone else folded.`
    : "Hands revealed. Pots were awarded automatically.";
  p.enter("playing");
  if (
    s.handNumber >= POKER_RULES.hands ||
    s.seats.filter((id) => s.chips[id] > 0).length < 2
  )
    finishPoker(p);
}
function beginDraw(p) {
  const s = p.pack;
  s.stage = "draw";
  s.pending = new Set(live(s));
  s.note = "Each remaining player may replace up to three cards, or stand pat.";
  setTurn(p, s.dealer);
}
function beginBet(p, stage) {
  const s = p.pack;
  s.stage = stage;
  s.currentBet = 0;
  s.increases = 0;
  s.roundPaid = Object.fromEntries(s.seats.map((id) => [id, 0]));
  s.pending = new Set(movable(s));
  s.raiseRights = new Set(movable(s));
  if (s.pending.size < 2) {
    if (stage === "bet1") beginDraw(p);
    else settle(p);
    return;
  }
  s.note =
    stage === "bet1"
      ? "First betting round. Check, bet or fold on your turn."
      : "Final betting round. Best remaining hand wins at showdown.";
  setTurn(p, s.dealer);
}
function advanceBet(p, after) {
  const s = p.pack;
  if (live(s).length === 1) {
    settle(p, true);
    return;
  }
  for (const id of s.pending)
    if (!movable(s).includes(id)) s.pending.delete(id);
  const canMove = movable(s);
  if (canMove.length === 1 && s.roundPaid[canMove[0]] >= s.currentBet)
    s.pending.clear();
  if (!s.pending.size) {
    if (s.stage === "bet1") beginDraw(p);
    else settle(p);
  } else setTurn(p, after);
}
function beginHand(p) {
  const s = p.pack;
  s.handSeats = s.seats.filter((id) => s.chips[id] > 0);
  s.dealer = clockwise(s, s.dealer).find((id) => s.handSeats.includes(id));
  s.handNumber++;
  s.deck = shuffle(
    ["♠", "♥", "♦", "♣"].flatMap((suit) =>
      ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"].map(
        (rank) => ({ id: randomUUID(), suit, rank }),
      ),
    ),
  );
  s.hands = Object.fromEntries(
    s.handSeats.map((id) => [id, s.deck.splice(0, 5)]),
  );
  s.contributions = Object.fromEntries(s.seats.map((id) => [id, 0]));
  s.folded = [];
  s.drawCounts = {};
  s.payouts = {};
  s.pots = [];
  s.rankings = {};
  s.showCards = false;
  s.lastPot = 0;
  for (const id of s.handSeats)
    pay(s, id, Math.min(POKER_RULES.ante, s.chips[id]));
  beginBet(p, "bet1");
}
export function openPoker(p) {
  const seats = p.roster.slice(0, POKER_RULES.seats);
  p.pack = {
    kind: "table",
    preset: "poker",
    guided: true,
    seats,
    chips: Object.fromEntries(seats.map((id) => [id, POKER_RULES.chips])),
    pot: 0,
    handNumber: 0,
    dealer: null,
    matchScored: false,
  };
  beginHand(p);
}
export function pokerActions(s, actor) {
  if (actor !== s.turn || !["bet1", "bet2"].includes(s.stage)) return {};
  const owed = Math.max(0, s.currentBet - s.roundPaid[actor]),
    chips = s.chips[actor];
  return {
    check: owed === 0,
    call: owed > 0 ? Math.min(owed, chips) : 0,
    fold: true,
    raise:
      s.raiseRights.has(actor) &&
      s.increases < POKER_RULES.increases &&
      chips > owed &&
      movable(s).some((id) => id !== actor)
        ? Math.min(owed + POKER_RULES.increment, chips)
        : 0,
  };
}
export function acceptPoker(p, actor, v) {
  const s = p.pack;
  requireFields(v, ["action"], v.action === "discard" ? ["cards"] : []);
  if (["deal", "finish"].includes(v.action)) {
    hostOnly(actor);
    if (s.stage !== "showdown")
      fail("Finish the current hand before dealing or ending the match.");
    if (v.action === "finish") finishPoker(p);
    else beginHand(p);
    return;
  }
  playerOnly(p, actor);
  if (actor !== s.turn) fail("Wait for your poker turn.");
  if (s.stage === "draw") {
    if (
      v.action !== "discard" ||
      !Array.isArray(v.cards) ||
      v.cards.length > POKER_RULES.draw ||
      new Set(v.cards).size !== v.cards.length ||
      v.cards.some(
        (id) =>
          typeof id !== "string" || !s.hands[actor].some((c) => c.id === id),
      )
    )
      fail("Choose zero to three different cards from your own hand.");
    s.hands[actor] = s.hands[actor].map((c) =>
      v.cards.includes(c.id) ? s.deck.shift() : c,
    );
    s.drawCounts[actor] = v.cards.length;
    s.pending.delete(actor);
    if (s.pending.size) setTurn(p, actor);
    else beginBet(p, "bet2");
    return;
  }
  const allowed = pokerActions(s, actor),
    owed = Math.max(0, s.currentBet - s.roundPaid[actor]);
  if (v.action === "fold") s.folded.push(actor);
  else if (v.action === "check" && allowed.check) {
  } else if (v.action === "call" && allowed.call) {
    pay(s, actor, allowed.call);
    s.roundPaid[actor] += allowed.call;
  } else if (v.action === "bet" && allowed.raise) {
    pay(s, actor, allowed.raise);
    s.roundPaid[actor] += allowed.raise;
    const increase = s.roundPaid[actor] - s.currentBet;
    s.currentBet = s.roundPaid[actor];
    if (increase >= POKER_RULES.increment) {
      s.increases++;
      s.pending = new Set(movable(s).filter((id) => id !== actor));
      s.raiseRights = new Set(movable(s).filter((id) => id !== actor));
    } else {
      // A short all-in requires matching but does not reopen a prior actor's raise.
      for (const id of movable(s))
        if (id !== actor && s.roundPaid[id] < s.currentBet) s.pending.add(id);
    }
  } else
    fail(
      owed
        ? "Call, raise or fold using the available controls."
        : "Choose an available poker action.",
    );
  s.pending.delete(actor);
  s.raiseRights.delete(actor);
  advanceBet(p, actor);
}
export function tickPoker(p) {
  const s = p.pack;
  if (!s.turn) return;
  const actor = s.turn,
    drawing = s.stage === "draw";
  acceptPoker(
    p,
    actor,
    drawing
      ? { action: "discard", cards: [] }
      : { action: s.currentBet > s.roundPaid[actor] ? "fold" : "check" },
  );
  s.note =
    `${name(p, actor)} ran out of time; ${drawing ? "the hand was kept" : "a safe automatic action was taken"}. ${s.note}`.slice(
      0,
      240,
    );
}
export function validatePokerCheckpoint(s, roster) {
  if (
    !Array.isArray(s.seats) ||
    s.seats.length < 2 ||
    s.seats.length > POKER_RULES.seats ||
    new Set(s.seats).size !== s.seats.length ||
    s.seats.some((id) => !roster.includes(id)) ||
    !Array.isArray(s.handSeats) ||
    !s.handSeats.length ||
    new Set(s.handSeats).size !== s.handSeats.length ||
    s.handSeats.some((id) => !s.seats.includes(id)) ||
    !["bet1", "draw", "bet2", "showdown", "complete"].includes(s.stage) ||
    !integer(s.handNumber, 1, POKER_RULES.hands) ||
    !(s.pending instanceof Set) ||
    !(s.raiseRights instanceof Set) ||
    [...s.pending, ...s.raiseRights].some((id) => !s.handSeats.includes(id)) ||
    !s.chips ||
    !s.contributions ||
    !s.hands ||
    !Array.isArray(s.folded) ||
    s.folded.some((id) => !s.handSeats.includes(id)) ||
    !integer(s.pot, 0, POKER_RULES.chips * s.seats.length) ||
    s.seats.some(
      (id) =>
        !integer(s.chips[id], 0, POKER_RULES.chips * s.seats.length) ||
        !integer(s.contributions[id], 0, POKER_RULES.chips * s.seats.length),
    ) ||
    s.seats.reduce((sum, id) => sum + s.chips[id], s.pot) !==
      POKER_RULES.chips * s.seats.length ||
    (s.turn !== null &&
      (!s.pending.has(s.turn) || !s.handSeats.includes(s.turn)))
  )
    fail("Unsupported poker recovery state.");
  try {
    for (const id of s.handSeats) rankHand(s.hands[id]);
  } catch {
    fail("Unsupported poker recovery state.");
  }
}
export function projectPoker(p, actor) {
  const s = p.pack;
  return {
    kind: "table",
    preset: "poker",
    guided: true,
    stage: s.stage,
    handNumber: s.handNumber,
    totalHands: POKER_RULES.hands,
    pot: s.pot,
    currentBet: s.currentBet,
    lastPot: s.lastPot,
    pots: s.pots.map((pot) => ({
      amount: pot.amount,
      refund: pot.refund,
      winners: pot.winners.map((id) => name(p, id)),
    })),
    note: s.note,
    turn: s.turn,
    turnName: s.turn ? name(p, s.turn) : null,
    hand: (s.hands[actor] ?? []).map((c) => ({ ...c })),
    handName:
      s.hands[actor]?.length === 5 ? rankHand(s.hands[actor]).name : null,
    canDraw: actor === s.turn && s.stage === "draw",
    active: s.handSeats.includes(actor),
    actions: pokerActions(s, actor),
    canDeal:
      actor === "host" && s.stage === "showdown" && p.phase === "playing",
    seats: s.seats.map((id) => ({
      id,
      name: name(p, id),
      chips: s.chips[id],
      contribution: s.contributions[id],
      dealer: id === s.dealer,
      folded: s.folded.includes(id),
      allIn: s.chips[id] === 0 && s.handSeats.includes(id),
      inHand: s.handSeats.includes(id),
      ...(Object.hasOwn(s.drawCounts, id) ? { drawn: s.drawCounts[id] } : {}),
      payout: s.payouts[id] ?? 0,
      ...(s.showCards && !s.folded.includes(id) && s.hands[id]?.length === 5
        ? {
            cards: s.hands[id].map((c) => ({ ...c })),
            handName: s.rankings[id]?.name,
          }
        : {}),
    })),
  };
}
