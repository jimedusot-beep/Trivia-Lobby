// SPDX-License-Identifier: AGPL-3.0-or-later
// Original canvas, content and implementation. No Scribble.rs artwork or word packs.
import {
  fail,
  requireFields,
  readable,
  integer,
  normalized,
  shuffle,
  playerOnly,
  renewed,
  award,
} from "./shared.js";
const words = [
  "snowman",
  "rainbow",
  "birthday cake",
  "tree house",
  "rocket",
  "sandcastle",
  "hot air balloon",
  "penguin",
  "telescope",
  "pizza",
  "octopus",
  "lighthouse",
  "waterfall",
  "bicycle",
  "campfire",
  "butterfly",
  "robot",
  "guitar",
  "volcano",
  "umbrella",
  "pirate ship",
  "dinosaur",
  "sunflower",
  "ice cream",
  "castle",
  "dragon",
  "sailboat",
  "pancakes",
  "suitcase",
  "crown",
];
export const inkColors = [
  "#20264b",
  "#e23867",
  "#2477db",
  "#158346",
  "#f0b83e",
  "#9455cc",
  "#ee7625",
  "#ffffff",
];
export function openDrawing(p) {
  p.pack = {
    kind: "draw",
    artist: p.roster[p.index],
    choices: shuffle(words).slice(0, 3),
    word: null,
    strokes: [],
    guesses: [],
    solved: new Set(),
    pointCount: 0,
    version: 0,
    stage: "choose",
  };
  renewed(p, 15000);
}
function choose(p, index) {
  const s = p.pack;
  s.word = s.choices[index];
  s.stage = "drawing";
  renewed(p, 60000);
}
export function acceptDrawing(p, actor, v) {
  const s = p.pack;
  requireFields(v, ["action"], ["index", "points", "color", "width", "text"]);
  playerOnly(p, actor);
  if (v.action === "choose") {
    if (actor !== s.artist || s.stage !== "choose" || !integer(v.index, 0, 2))
      fail("Only the artist can choose a word.");
    choose(p, v.index);
    return;
  }
  if (s.stage !== "drawing") fail("Drawing has not opened.");
  if (["stroke", "undo", "clear"].includes(v.action)) {
    if (actor !== s.artist) fail("Only the artist can draw.");
    if (v.action === "clear") {
      s.strokes = [];
      s.pointCount = 0;
      s.version++;
      return;
    }
    if (v.action === "undo") {
      const stroke = s.strokes.pop();
      s.pointCount -= stroke?.points.length ?? 0;
      s.version++;
      return;
    }
    if (
      !inkColors.includes(v.color) ||
      !integer(v.width, 2, 24) ||
      !Array.isArray(v.points) ||
      v.points.length < 2 ||
      v.points.length > 64 ||
      v.points.some(
        (pt) =>
          !Array.isArray(pt) ||
          pt.length !== 2 ||
          !pt.every((n) => integer(n, 0, 1000)),
      )
    )
      fail("Invalid drawing stroke.");
    if (s.strokes.length >= 160 || s.pointCount + v.points.length > 1200)
      fail("Canvas is full. Undo a stroke or clear it to keep drawing.");
    s.strokes.push({
      points: v.points.map((pt) => [...pt]),
      color: v.color,
      width: v.width,
    });
    s.pointCount += v.points.length;
    s.version++;
    return;
  }
  if (v.action === "guess") {
    if (actor === s.artist || s.solved.has(actor))
      fail("You cannot guess this word now.");
    const text = readable(v.text, 60),
      correct = normalized(text) === normalized(s.word);
    if (correct) {
      s.solved.add(actor);
      award(
        p,
        actor,
        100 + Math.ceil(Math.max(0, p.deadline - p.clock()) / 1000),
      );
      award(p, s.artist, 50);
    }
    s.guesses.push({
      name: p.players.get(actor).name,
      text: correct ? "Guessed it!" : text,
      correct,
    });
    if (s.guesses.length > 16) s.guesses.shift();
    if (s.solved.size === p.roster.length - 1) {
      s.stage = "reveal";
      p.enter("reveal");
    }
    return;
  }
  fail("Unknown drawing action.");
}
export function tickDrawing(p) {
  if (p.pack.stage === "choose") choose(p, 0);
  else {
    p.pack.stage = "reveal";
    p.enter("reveal");
  }
}
export function nextDrawing(p) {
  if (++p.index >= p.roster.length) p.enter("finished");
  else openDrawing(p);
}
export function projectDrawing(p, actor) {
  const s = p.pack;
  return {
    kind: "draw",
    stage: s.stage,
    artist: s.artist,
    artistName: p.players.get(s.artist).name,
    round: p.index + 1,
    total: p.roster.length,
    strokes: s.strokes,
    version: s.version,
    guesses: s.guesses,
    solved: s.solved.size,
    canGuess:
      s.stage === "drawing" &&
      actor !== "host" &&
      actor !== s.artist &&
      !s.solved.has(actor),
    canDraw: actor === s.artist && s.stage === "drawing",
    ...(actor === s.artist || p.phase === "reveal"
      ? { word: s.word }
      : s.word
        ? { hint: [...s.word].map((c) => (c === " " ? " / " : "_")).join(" ") }
        : {}),
    ...(s.stage === "choose" && actor === s.artist
      ? { choices: s.choices }
      : {}),
  };
}
