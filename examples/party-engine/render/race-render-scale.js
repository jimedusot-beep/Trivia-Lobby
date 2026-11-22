// SPDX-License-Identifier: AGPL-3.0-or-later
// Pure backing-store scale selection. Fewer cameras get more pixels; the
// eight-camera case keeps the validated 0.8x guard. No DOM or Three.js dependency.

export const SPLIT_RENDER_SCALES = Object.freeze({
  1: 1,
  2: 1,
  3: 0.9,
  4: 0.9,
  5: 0.8,
  6: 0.8,
  7: 0.8,
  8: 0.8,
});

export function splitRenderScale(count, reducedMotion = false) {
  if (reducedMotion) return 1;
  const scale = SPLIT_RENDER_SCALES[Math.floor(Number(count))];
  return Number.isFinite(scale) ? scale : 1;
}
