// SPDX-License-Identifier: MIT
// Selected helpers adapted from BridgeMind's Turbo Kart Rush, pinned in
// docs/OPEN_GAME_SOURCES.json. Copyright (c) 2026 BridgeMind.
// Full permission notice: ../open-pack/licenses/race.txt (also shipped in credits).
export const TAU = Math.PI * 2;
export const clamp = (v, min, max) => v < min ? min : v > max ? max : v;
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (current, target, lambda, dt) =>
  lerp(current, target, 1 - Math.exp(-lambda * dt));
export function wrapAngle(a) {
  a %= TAU;
  if (a > Math.PI) a -= TAU;
  if (a < -Math.PI) a += TAU;
  return a;
}
export function wrap01(t) {
  t %= 1;
  return t < 0 ? t + 1 : t;
}
export function trackDelta(a, b) {
  let d = wrap01(b) - wrap01(a);
  if (d > 0.5) d -= 1;
  if (d < -0.5) d += 1;
  return d;
}
// Three-tier drift tuning adapted from upstream src/kart/Kart.ts.
export const DRIFT_THRESHOLDS = Object.freeze([1, 2, 3.2]);
export const DRIFT_BOOST_SECONDS = Object.freeze([0, 0.7, 1.2, 1.8]);

