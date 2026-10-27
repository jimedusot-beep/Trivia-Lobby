// Local CPU comparison against the released implementation; not a latency SLA.
import { execFileSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { nearestTrack, trackPoint } from '../examples/party-engine/public/race-track.js';
const root = fileURLToPath(new URL('../', import.meta.url));
const revision = 'b4f58ebd3a068157e2e7317356290c482746a96e';
const math = pathToFileURL(root + 'examples/party-engine/public/race-math.js').href;
const source = execFileSync('git', ['show', `${revision}:examples/party-engine/public/race-track.js`], { cwd: root, encoding: 'utf8' }).replace('"./race-math.js"', JSON.stringify(math));
const before = (await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'))).nearestTrack;
const points = Array.from({ length: 4096 }, (_, i) => {
  const p = trackPoint(i / 4096); return [p.x + Math.sin(i) * 70, p.y + Math.cos(i) * 70];
});
let checksum = 0;
function run(fn) {
  const start = performance.now();
  for (let n = 0; n < 5; n++) for (const [x, y] of points) checksum += fn(x, y).distance;
  return performance.now() - start;
}
run(before); run(nearestTrack);
const old = [], now = [];
for (let i = 0; i < 7; i++) {
  if (i % 2) { now.push(run(nearestTrack)); old.push(run(before)); }
  else { old.push(run(before)); now.push(run(nearestTrack)); }
}
const median = a => a.sort((a, b) => a - b)[Math.floor(a.length / 2)];
const a = median(old), b = median(now);
console.log(JSON.stringify({ baseline: revision, queriesPerRound: points.length * 5, rounds: 7,
  beforeMedianMs: a, afterMedianMs: b, speedup: a / b, cpuReductionPercent: (1 - b / a) * 100, checksum }, null, 2));
