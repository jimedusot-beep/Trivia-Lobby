// SPDX-License-Identifier: AGPL-3.0-or-later
// Stable visual slots for the server's filtered hazard list. The wire format
// intentionally carries only live positions, so a fixed pool of meshes must
// reuse a slot when one hazard expires without moving every surviving puddle.

const keyOf = hazard => hazard && Number.isFinite(hazard.x) && Number.isFinite(hazard.y)
  ? `${hazard.x},${hazard.y}`
  : null;

export function assignHazardSlots(hazards, previous, capacity) {
  const count = Math.max(0, Math.floor(Number(capacity)) || 0);
  const next = Array(count).fill(null);
  const before = Array.isArray(previous) ? previous : [];
  const claimed = new Set();
  const added = [];

  // Reserve survivors first so a new hazard appearing earlier in the filtered
  // list cannot evict an existing puddle from its previous visual slot.
  for (const hazard of Array.isArray(hazards) ? hazards : []) {
    const key = keyOf(hazard);
    if (!key || claimed.has(key)) continue;
    const slot = before.indexOf(key);
    if (slot >= 0 && slot < count && next[slot] === null) {
      next[slot] = key;
      claimed.add(key);
    } else added.push(key);
  }
  for (const key of added) {
    if (claimed.has(key)) continue;
    const slot = next.indexOf(null);
    if (slot < 0) break;
    next[slot] = key;
    claimed.add(key);
  }
  return next;
}
