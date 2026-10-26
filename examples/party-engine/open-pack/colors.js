// SPDX-License-Identifier: AGPL-3.0-or-later
// Original server adapter and presentation; licensed deck/turn/scoring in color-rules.js.
import {
  fail,
  requireFields,
  integer,
  playerOnly,
  renewed,
  award,
  shuffle,
} from "./shared.js";
import { generateDeck, colors, nextIndex, roundPoints } from "./color-rules.js";
export function openColors(p) {
  const settings = p.packSettings ?? {},
    humans = p.roster.slice(0, 10),
    botCount = Math.min(settings.bots ?? 0, 10 - humans.length);
  const seats = [
      ...humans,
      ...Array.from({ length: botCount }, (_, i) => `bot-${i}`),
    ],
    deck = generateDeck(),
    hands = Object.fromEntries(seats.map((id) => [id, deck.splice(0, 7)]));
  let first = deck.findIndex((c) => /^\d$/.test(c.value)),
    top = deck.splice(first, 1)[0];
  p.pack = {
    kind: "colors",
    seats,
    hands,
    deck,
    discard: [top],
    color: top.color,
    direction: 1,
    turn: 0,
    pending: 0,
    pendingType: null,
    drawn: null,
    stacking: !!settings.stacking,
    turnMs: (settings.turnSeconds ?? 30) * 1000,
    note: "Match a color or symbol. Empty your hand to win.",
    moves: 0,
  };
  arm(p);
}
const bot = (id) => id.startsWith("bot-");
function arm(p) {
  const s = p.pack;
  renewed(p, bot(s.seats[s.turn]) ? 900 : s.turnMs);
}
function refill(s) {
  if (s.deck.length === 0 && s.discard.length > 1) {
    const top = s.discard.pop();
    s.deck = shuffle(s.discard);
    s.discard = [top];
  }
}
function take(s, id, count) {
  for (let n = 0; n < count; n++) {
    refill(s);
    if (!s.deck.length) break;
    s.hands[id].push(s.deck.pop());
  }
}
function advance(p, steps = 1) {
  const s = p.pack;
  s.drawn = null;
  s.turn = nextIndex(s.turn, s.direction, s.seats.length, steps);
  s.moves++;
  if (s.moves >= 1000) {
    s.note = "Match ended after 1,000 turns. Lowest hand count wins.";
    const low = Math.min(...Object.values(s.hands).map((h) => h.length));
    for (const id of s.seats) if (s.hands[id].length === low) award(p, id, 100);
    p.enter("reveal");
  } else arm(p);
}
function canPlay(s, id, card) {
  if (s.drawn && card.id !== s.drawn) return false;
  if (s.pending)
    return (
      s.stacking &&
      (card.value === "wild_draw_four" ||
        (s.pendingType === "draw_two" && card.value === "draw_two"))
    );
  if (
    card.value === "wild_draw_four" &&
    s.hands[id].some((c) => c.color === s.color)
  )
    return false;
  const top = s.discard.at(-1);
  return (
    card.color === "wild" || card.color === s.color || card.value === top.value
  );
}
function play(p, id, card, color) {
  const s = p.pack;
  if (card.color === "wild" && !colors.includes(color))
    fail("Choose a wild color.");
  const i = s.hands[id].findIndex((c) => c.id === card.id);
  s.hands[id].splice(i, 1);
  s.discard.push(card);
  s.color = card.color === "wild" ? color : card.color;
  let steps = 1;
  if (card.value === "reverse") {
    s.direction *= -1;
    if (s.seats.length === 2) steps = 2;
  }
  if (card.value === "skip") steps = 2;
  if (card.value === "draw_two" || card.value === "wild_draw_four") {
    const n = card.value === "draw_two" ? 2 : 4;
    s.pending += n;
    s.pendingType = card.value;
    if (!s.stacking || s.hands[id].length === 0) {
      const next = s.seats[nextIndex(s.turn, s.direction, s.seats.length)];
      take(s, next, s.pending);
      s.pending = 0;
      s.pendingType = null;
      steps = 2;
    }
  }
  s.note = `${name(p, id)} played ${card.value.replaceAll("_", " ")}.`;
  if (s.hands[id].length === 0) {
    s.winner = id;
    const points = Math.max(1, roundPoints(s.hands, id));
    award(p, id, points);
    s.note = `${name(p, id)} wins ${points} points!`;
    p.enter("reveal");
  } else advance(p, steps);
}
export function name(p, id) {
  return id.startsWith("bot-")
    ? `Spark Bot ${Number(id.slice(4)) + 1}`
    : (p.players.get(id)?.name ?? "Player");
}
export function acceptColors(p, actor, v) {
  const s = p.pack;
  requireFields(v, ["action"], ["card", "color"]);
  playerOnly(p, actor);
  if (s.seats[s.turn] !== actor) fail("Wait for your turn.");
  if (v.action === "play") {
    const card = s.hands[actor].find((c) => c.id === v.card);
    if (!card || !canPlay(s, actor, card))
      fail("That card cannot be played now.");
    play(p, actor, card, v.color);
    return;
  }
  if (v.action === "draw") {
    if (s.drawn) fail("Play the drawn card or pass.");
    if (s.pending) {
      take(s, actor, s.pending);
      s.note = `${name(p, actor)} drew ${s.pending}.`;
      s.pending = 0;
      s.pendingType = null;
      advance(p);
      return;
    }
    const before = s.hands[actor].length;
    take(s, actor, 1);
    s.drawn = s.hands[actor].length > before ? s.hands[actor].at(-1).id : null;
    if (s.drawn && canPlay(s, actor, s.hands[actor].at(-1))) {
      s.note = "Play your drawn card or pass.";
      arm(p);
    } else advance(p);
    return;
  }
  if (v.action === "pass") {
    if (!s.drawn) fail("Draw before passing.");
    advance(p);
    return;
  }
  fail("Unknown card action.");
}
export function tickColors(p) {
  const s = p.pack,
    id = s.seats[s.turn],
    hand = s.hands[id];
  if (bot(id)) {
    let card = hand.find((c) => canPlay(s, id, c));
    if (card) {
      const color = [...colors].sort(
        (a, b) =>
          hand.filter((c) => c.color === b).length -
          hand.filter((c) => c.color === a).length,
      )[0];
      play(p, id, card, color);
      return;
    }
  }
  take(s, id, s.pending || 1);
  s.pending = 0;
  s.pendingType = null;
  s.note = `${name(p, id)} drew and passed.`;
  advance(p);
}
export function projectColors(p, actor) {
  const s = p.pack,
    id = s.seats[s.turn];
  return {
    kind: "colors",
    seats: s.seats.map((id) => ({
      id,
      name: name(p, id),
      count: s.hands[id].length,
      bot: bot(id),
    })),
    top: s.discard.at(-1),
    color: s.color,
    direction: s.direction,
    turn: id,
    turnName: name(p, id),
    pending: s.pending,
    stacking: s.stacking,
    note: s.note,
    drawn: actor === id ? s.drawn : null,
    hand:
      s.hands[actor]?.map((c) => ({
        ...c,
        playable: p.phase === "playing" && actor === id && canPlay(s, actor, c),
      })) ?? [],
    spectating: actor !== "host" && !s.seats.includes(actor),
    canPlay: p.phase === "playing" && actor === id,
    winner: s.winner ?? null,
  };
}
