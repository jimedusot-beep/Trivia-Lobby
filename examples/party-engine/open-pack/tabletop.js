// SPDX-License-Identifier: AGPL-3.0-or-later
// Original small manual-rules table inspired by VirtualTabletop's shared surface.
// No upstream game pack, artwork, routine code or trademarks are included.
import {
  fail,
  requireFields,
  integer,
  randomInt,
  randomUUID,
  shuffle,
  hostOnly,
  playerOnly,
  renewed,
  award,
} from "./shared.js";
const newDeck = () =>
  shuffle(
    ["♠", "♥", "♦", "♣"].flatMap((suit) =>
      ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"].map(
        (rank) => ({ id: randomUUID(), suit, rank }),
      ),
    ),
  );
function deal(s) {
  const count = s.preset === "whist" ? 13 : 5;
  s.deck = newDeck();
  s.hands = Object.fromEntries(
    s.seats.map((id) => [id, s.deck.splice(0, count)]),
  );
  s.center = [];
  s.revealed = [];
  s.dice = [];
  s.handNumber++;
}
export function openTabletop(p) {
  const preset = p.packSettings?.preset ?? "poker",
    seats = p.roster.slice(0, preset === "whist" ? 4 : 10);
  p.pack = {
    kind: "table",
    preset,
    seats,
    chips: Object.fromEntries(seats.map((id) => [id, 200])),
    pot: 0,
    handNumber: 0,
    note: "Manual rules: agree on turns, bets and the winner with your group.",
  };
  deal(p.pack);
  renewed(p, 1200000);
}
export function acceptTabletop(p, actor, v) {
  const s = p.pack;
  requireFields(v, ["action"], ["card", "amount", "seat"]);
  if (["deal", "settle", "finish"].includes(v.action)) hostOnly(actor);
  else {
    playerOnly(p, actor);
    if (!s.seats.includes(actor)) fail("Spectators cannot change the table.");
  }
  if (v.action === "play") {
    const i = s.hands[actor].findIndex((c) => c.id === v.card);
    if (i < 0) fail("Choose a card from your own hand.");
    s.center.push({ ...s.hands[actor].splice(i, 1)[0], owner: actor });
    s.note = `${p.players.get(actor).name} played a card.`;
  } else if (v.action === "take-back") {
    const i = s.center.findIndex((c) => c.id === v.card && c.owner === actor);
    if (i < 0) fail("Only your own played cards can be taken back.");
    const { owner, ...card } = s.center.splice(i, 1)[0];
    s.hands[actor].push(card);
  } else if (v.action === "reveal-hand") {
    if (!s.revealed.includes(actor)) s.revealed.push(actor);
  } else if (v.action === "bet") {
    if (!integer(v.amount, 1, s.chips[actor]))
      fail("Choose a whole number of chips that you have.");
    s.chips[actor] -= v.amount;
    s.pot += v.amount;
  } else if (v.action === "roll") s.dice = [randomInt(1, 7), randomInt(1, 7)];
  else if (v.action === "deal") {
    if (s.pot) fail("Award the current pot before dealing a new hand.");
    deal(s);
    s.note = "New hand dealt. Agree on your table's rules.";
  } else if (v.action === "settle") {
    if (!integer(v.seat, 0, s.seats.length - 1) || s.pot === 0)
      fail("Choose a player to receive a nonempty pot.");
    const id = s.seats[v.seat];
    s.note = `${p.players.get(id).name} receives ${s.pot} chips (host decision).`;
    s.chips[id] += s.pot;
    s.pot = 0;
  } else if (v.action === "finish") {
    if (s.pot) fail("Award the pot before finishing.");
    const high = Math.max(...Object.values(s.chips));
    for (const id of s.seats) if (s.chips[id] === high) award(p, id, 100);
    p.enter("reveal");
    return;
  } else fail("Unknown table action.");
  p.revision++;
}
export function projectTabletop(p, actor) {
  const s = p.pack;
  return {
    kind: "table",
    preset: s.preset,
    handNumber: s.handNumber,
    pot: s.pot,
    note: s.note,
    dice: s.dice,
    deckCount: s.deck.length,
    center: s.center.map((c) => ({
      ...c,
      ownerName: p.players.get(c.owner).name,
    })),
    seats: s.seats.map((id, index) => ({
      id,
      index,
      name: p.players.get(id).name,
      count: s.hands[id].length,
      chips: s.chips[id],
      ...(s.revealed.includes(id)
        ? { cards: s.hands[id].map((c) => ({ ...c })) }
        : {}),
    })),
    hand: s.hands[actor]?.map((c) => ({ ...c })) ?? [],
    active: s.seats.includes(actor) && p.phase === "playing",
  };
}
export function openBackgammon(p) {
  const points = Array(24).fill(0);
  for (const [position, count] of [
    [0, 2],
    [11, 5],
    [16, 3],
    [18, 5],
  ])
    points[position] = count;
  for (const [position, count] of [
    [23, 2],
    [12, 5],
    [7, 3],
    [5, 5],
  ])
    points[position] = -count;
  p.pack = {
    kind: "backgammon",
    seats: p.roster.slice(0, 2),
    points,
    bar: [0, 0],
    off: [0, 0],
    turn: 0,
    dice: [],
    note: "Manual dice rules: players agree which moves use the dice, including bearing off.",
  };
  renewed(p, 1200000);
}
export function acceptBackgammon(p, actor, v) {
  const s = p.pack;
  requireFields(v, ["action"], ["from", "to"]);
  playerOnly(p, actor);
  const side = s.seats.indexOf(actor);
  if (side !== s.turn) fail("Wait for your backgammon turn.");
  if (v.action === "roll") {
    if (s.dice.length) fail("Finish this turn before rolling again.");
    s.dice = [randomInt(1, 7), randomInt(1, 7)];
  } else if (v.action === "end-turn") {
    if (!s.dice.length) fail("Roll before ending the turn.");
    s.turn = 1 - s.turn;
    s.dice = [];
  } else if (v.action === "move") {
    if (
      !s.dice.length ||
      !integer(v.from, 0, 24) ||
      !integer(v.to, 0, 25) ||
      v.to === 24 ||
      v.to === v.from
    )
      fail("Roll, then choose a checker and destination.");
    const sign = side === 0 ? 1 : -1;
    if (v.from === 24) {
      if (!s.bar[side]) fail("No checker on your bar.");
    } else if (s.points[v.from] * sign <= 0)
      fail("Choose one of your checkers.");
    if (v.to < 24 && s.points[v.to] * sign < -1) fail("That point is blocked.");
    if (v.from === 24) s.bar[side]--;
    else s.points[v.from] -= sign;
    if (v.to === 25) s.off[side]++;
    else {
      if (s.points[v.to] === -sign) {
        s.bar[1 - side]++;
        s.points[v.to] = 0;
      }
      s.points[v.to] += sign;
    }
    if (s.off[side] === 15) {
      s.winner = actor;
      award(p, actor, 100);
      p.enter("reveal");
      return;
    }
  } else fail("Unknown backgammon action.");
  p.revision++;
}
export function projectBackgammon(p, actor) {
  const s = p.pack;
  return {
    kind: "backgammon",
    seats: s.seats.map((id) => ({ id, name: p.players.get(id).name })),
    points: [...s.points],
    bar: [...s.bar],
    off: [...s.off],
    turn: s.turn,
    dice: [...s.dice],
    note: s.note,
    canMove: p.phase === "playing" && s.seats[s.turn] === actor,
    winner: s.winner ?? null,
  };
}
