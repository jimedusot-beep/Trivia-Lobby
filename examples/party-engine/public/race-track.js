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
// Segment geometry is invariant; reuse it across all karts and simulation steps.
const segments = TRACK_POINTS.map((a, i) => {
  const b = TRACK_POINTS[(i + 1) % TRACK_POINTS.length];
  const dx = b.x - a.x, dy = b.y - a.y;
  return { x: a.x, y: a.y, dx, dy, lengthSquared: dx * dx + dy * dy,
    angle: Math.atan2(dy, dx) };
});
export function nearestTrack(x, y) {
  let best = Infinity, bestIndex = -1, bestU = 0, bestX = 0, bestY = 0;
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    const u = Math.max(0, Math.min(1, ((x - s.x) * s.dx + (y - s.y) * s.dy) / s.lengthSquared));
    const px = s.x + s.dx * u, py = s.y + s.dy * u;
    const d = (x - px) ** 2 + (y - py) ** 2;
    if (d < best) {
      best = d; bestIndex = i; bestU = u; bestX = px; bestY = py;
    }
  }
  if (bestIndex < 0) return undefined;
  return { x: bestX, y: bestY, t: wrap01((bestIndex + bestU) / TRACK.samples),
    angle: segments[bestIndex].angle, distance: Math.sqrt(best) };
}
export const ITEM_SPOTS = Object.freeze([0.13, 0.36, 0.62, 0.85]);
export const BOOST_SPOTS = Object.freeze([0.24, 0.74]);
export const ITEM_LABELS = Object.freeze({ dash: "Rocket boost", shield: "Bubble shield", spark: "Zap the kart ahead", paint: "Drop a slippery puddle" });

