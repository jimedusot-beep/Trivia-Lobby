import test from 'node:test';
import assert from 'node:assert/strict';
import { TRACK, TRACK_POINTS, trackPoint, nearestTrack } from '../public/race-track.js';
import { wrap01 } from '../public/race-math.js';

// Released global-scan algorithm: the oracle preserves its ordering and ties.
function releasedNearest(x, y) {
  let best = Infinity, result;
  for (let i = 0; i < TRACK_POINTS.length; i++) {
    const a = TRACK_POINTS[i], b = TRACK_POINTS[(i + 1) % TRACK_POINTS.length];
    const dx = b.x - a.x, dy = b.y - a.y;
    const u = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy)));
    const px = a.x + dx * u, py = a.y + dy * u, d = (x - px) ** 2 + (y - py) ** 2;
    if (d < best) {
      best = d;
      result = { x: px, y: py, t: wrap01((i + u) / TRACK.samples), angle: Math.atan2(dy, dx), distance: Math.sqrt(d) };
    }
  }
  return result;
}
test('optimized track projection exactly matches released geometry and seam/tie behavior', () => {
  const points = [[600,360], [0,0], [1200,720], [Infinity,0], [NaN,0]];
  for (let i = 0; i <= 512; i++) {
    const p = trackPoint(i / 512);
    for (const offset of [-150,-48,0,48,150]) points.push([p.x + offset, p.y - offset]);
  }
  for (const p of TRACK_POINTS) points.push([p.x,p.y]);
  for (const [x,y] of points) assert.deepEqual(nearestTrack(x,y), releasedNearest(x,y));
});
