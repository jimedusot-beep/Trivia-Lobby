// SPDX-License-Identifier: AGPL-3.0-or-later
import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { Party } from "../engine.js";
import { RACE_STEP_MS } from "../open-pack/race.js";

const percentile = (values, fraction) => {
  const ordered = [...values].sort((a, b) => a - b);
  return Math.round(ordered[Math.ceil(ordered.length * fraction) - 1] * 10000) / 10000;
};
async function record(report) {
  await mkdir("performance-results", { recursive: true });
  await writeFile("performance-results/race-simulation.json", JSON.stringify(report, null, 2) + "\n");
  console.log("MEASURED_RACE_SIMULATION=" + JSON.stringify(report));
}

test("eight simultaneous racers keep authoritative simulation steps bounded", async () => {
  const samples = [];
  let frames = 0;
  for (let round = 0; round < 3; round++) {
    let now = 1000;
    const p = new Party(`SIM80${round}`, { clock: () => now, countdownMs: 1 });
    for (let i = 0; i < 8; i++) p.join(`Racer ${i + 1}`);
    p.handle("host", { v: 1, type: "start", requestId: `sim8-start-${round}`,
      matchId: p.matchId, revision: p.revision, value: "race" });
    now++;
    p.tick();
    for (let i = 0; i < 600; i++) {
      const before = performance.now();
      now += RACE_STEP_MS;
      p.tick();
      samples.push(performance.now() - before);
      frames++;
    }
    expect(p.pack.karts).toHaveLength(8);
    expect(p.pack.frame).toBeGreaterThan(500);
    expect(p.phase).toBe("playing");
  }
  const p50 = percentile(samples, 0.5), p95 = percentile(samples, 0.95);
  const worst = percentile(samples, 1);
  await record({
    method: "Local Node.js authoritative Party tick with eight concurrent kart inputs",
    racers: 8,
    ticks: samples.length,
    p50Ms: p50,
    p95Ms: p95,
    worstMs: worst,
    frames,
    warning: "Local loopback timing is not a real TV or iPhone measurement and does not replace device testing.",
  });
  expect(p95).toBeLessThan(2);
  expect(worst).toBeLessThan(10);
});
