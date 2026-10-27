// SPDX-License-Identifier: AGPL-3.0-or-later
// Original shared geometry. The server and the TV draw the same closed circuit.
import { TAU, wrap01 } from "./race-math.js";
export const TRACK = Object.freeze({ width: 1200, height: 720, halfRoad: 48, samples: 256 });
export const RACE_COLORS = Object.freeze([
  "#ff5d73", "#348bff", "#ffc83d", "#27bfa6", "#a777ef",
  "#ff8c42", "#e35ec7", "#77b83d", "#32bfd3", "#a0785c",
  "#c94458", "#435ac9", "#d29805", "#0a9079", "#7749ba",
  "#c76522", "#b52e91", "#4d7e24", "#137f9e", "#6d4938",
]);
export function trackPoint(t) {
  const a = wrap01(t) * TAU;
  return { x: 600 + 440 * Math.cos(a) + 30 * Math.cos(a * 3),
    y: 360 + 235 * Math.sin(a) - 16 * Math.sin(a * 3) };
}
export function trackPose(t) {
  const p = trackPoint(t), n = trackPoint(t + 0.0001);
  return { ...p, angle: Math.atan2(n.y - p.y, n.x - p.x) };
}
export const TRACK_POINTS = Object.freeze(Array.from({ length: TRACK.samples }, (_, i) => trackPoint(i / TRACK.samples)));
export const TRACK_LENGTH = TRACK_POINTS.reduce((sum, p, i) => {
  const n = TRACK_POINTS[(i + 1) % TRACK.samples];
  return sum + Math.hypot(n.x - p.x, n.y - p.y);
}, 0);
export function nearestTrack(x, y) {
  let best = Infinity, result;
  for (let i = 0; i < TRACK_POINTS.length; i++) {
    const a = TRACK_POINTS[i], b = TRACK_POINTS[(i + 1) % TRACK_POINTS.length];
    const dx = b.x - a.x, dy = b.y - a.y;
    const u = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy)));
    const px = a.x + dx * u, py = a.y + dy * u, d = (x - px) ** 2 + (y - py) ** 2;
    if (d < best) {
      best = d;
      result = { x: px, y: py, t: wrap01((i + u) / TRACK.samples),
        angle: Math.atan2(dy, dx), distance: Math.sqrt(d) };
    }
  }
  return result;
}
export const ITEM_SPOTS = Object.freeze([0.13, 0.36, 0.62, 0.85]);
export const BOOST_SPOTS = Object.freeze([0.24, 0.74]);
export const ITEM_LABELS = Object.freeze({ dash: "Rocket boost", shield: "Bubble shield", spark: "Zap the kart ahead", paint: "Drop a slippery puddle" });

