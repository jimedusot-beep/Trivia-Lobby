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
  "elephant", "giraffe", "jellyfish", "kangaroo", "turtle", "flamingo",
  "hedgehog", "crocodile", "ladybird", "seahorse", "peacock", "squirrel",
  "dolphin", "snail", "crab", "bat", "owl", "rabbit", "whale", "zebra",
  "toothbrush", "backpack", "alarm clock", "rubber duck", "teapot",
  "roller skates", "watering can", "headphones", "popcorn", "snow globe",
  "beach", "library", "train station", "playground", "mountain", "farm",
  "swimming pool", "space station", "campsite", "water park", "desert",
  "aquarium", "bakery", "bridge", "island", "museum", "garden", "cave",
  "windmill", "igloo", "submarine", "fire engine", "snowflake", "mailbox",
  "trophy", "hammock", "paintbrush", "binoculars", "washing machine", "swing",
];
export const DRAW_LIMITS = Object.freeze({ points: 2400, strokes: 200, segment: 64 });
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
  const used = p.pack?.kind === "draw" ? [...(p.pack.used ?? [])] : [];
  p.pack = {
    kind: "draw",
    artist: p.roster[p.index],
    choices: shuffle(words.filter(word => !used.includes(word))).slice(0, 3),
    used,
    word: null,
    strokes: [],
    redo: [],
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
  (s.used ??= []).push(s.word);
  s.stage = "drawing";
  renewed(p, 60000);
}
export function acceptDrawing(p, actor, v) {
  const s = p.pack;
  requireFields(v, ["action"], ["index", "points", "color", "width", "text", "strokeId", "part"]);
  playerOnly(p, actor);
  if (v.action === "choose") {
    if (actor !== s.artist || s.stage !== "choose" || !integer(v.index, 0, 2))
      fail("Only the artist can choose a word.");
    choose(p, v.index);
    return;
  }
  if (s.stage !== "drawing") fail("Drawing has not opened.");
  if (["stroke", "undo", "redo", "clear"].includes(v.action)) {
    if (actor !== s.artist) fail("Only the artist can draw.");
    if (v.action === "clear") {
      s.strokes = [];
      s.pointCount = 0;
      s.redo = [];
      s.version++;
      return;
    }
    if (v.action === "undo") {
      const last = s.strokes.at(-1), group = [];
      if (last) {
        do { group.unshift(s.strokes.pop()); }
        while(last.strokeId && s.strokes.at(-1)?.strokeId===last.strokeId);
        s.pointCount -= group.reduce((n,stroke)=>n+stroke.points.length,0);
        (s.redo ??= []).push(group);
      }
      s.version++;
      return;
    }
    if (v.action === "redo") {
      const group = s.redo?.pop();
      if (group) {s.strokes.push(...group);s.pointCount+=group.reduce((n,stroke)=>n+stroke.points.length,0);}
      s.version++;
      return;
    }
    if (
      !inkColors.includes(v.color) ||
      !integer(v.width, 2, 24) ||
      !Array.isArray(v.points) ||
      v.points.length < 2 ||
      v.points.length > DRAW_LIMITS.segment ||
      v.points.some(
        (pt) =>
          !Array.isArray(pt) ||
          pt.length !== 2 ||
          !pt.every((n) => integer(n, 0, 1000)),
      )
    )
      fail("Invalid drawing stroke.");
    const grouped = v.strokeId !== undefined || v.part !== undefined;
    if (grouped) {
      if(typeof v.strokeId!=="string" || !/^[a-f0-9]{32}$/.test(v.strokeId) || !integer(v.part,0,511)) fail("Invalid stroke sequence.");
      const last=s.strokes.at(-1), earlier=s.strokes.some(stroke=>stroke.strokeId===v.strokeId);
      if(earlier ? last?.strokeId!==v.strokeId || v.part!==last.part+1 || last.color!==v.color || last.width!==v.width || last.points.at(-1).join(",")!==v.points[0].join(",") : v.part!==0)
        fail("This drawing segment is out of order.");
    }
    if (s.strokes.length >= DRAW_LIMITS.strokes || s.pointCount + v.points.length > DRAW_LIMITS.points)
      fail("Canvas is full. Undo a stroke or clear it to keep drawing.");
    s.strokes.push({
      points: v.points.map((pt) => [...pt]),
      color: v.color,
      width: v.width,
      ...(grouped?{strokeId:v.strokeId,part:v.part}:{}),
    });
    s.redo = [];
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
    hasGuessed: s.solved.has(actor),
    canUndo: actor === s.artist && s.strokes.length > 0 && s.stage === "drawing",
    canRedo: actor === s.artist && !!s.redo?.length && s.stage === "drawing",
    remainingPoints: DRAW_LIMITS.points - s.pointCount,
    remainingSegments: DRAW_LIMITS.strokes - s.strokes.length,
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
