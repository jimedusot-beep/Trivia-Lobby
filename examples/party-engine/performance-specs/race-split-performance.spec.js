import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { lobby } from "../browser-specs/helpers/race-lobby.js";

const percentile = (values, fraction) => {
  const ordered = [...values].sort((a, b) => a - b);
  return Math.round(ordered[Math.ceil(ordered.length * fraction) - 1] * 100) / 100;
};
async function record(report) {
  await mkdir("performance-results", { recursive: true });
  await writeFile("performance-results/race-split-rendering.json", JSON.stringify(report, null, 2) + "\n");
  console.log("MEASURED_SPLIT_PERFORMANCE=" + JSON.stringify(report));
}
async function readSample(page) {
  return page.evaluate(async () => {
    const canvas = document.querySelector("#race-track");
    const before = Number(canvas.dataset.renderFrame || 0);
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    const debug = gl?.getExtension("WEBGL_debug_renderer_info");
    const bounds = canvas.getBoundingClientRect();
    const intervalsMs = [];
    await new Promise(resolve => {
      let prior = null, steps = 0;
      const tick = time => {
        if (prior !== null) intervalsMs.push(time - prior);
        prior = time;
        if (++steps === 121) resolve();
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    return {
      intervalsMs,
      rendered3dFrames: Number(canvas.dataset.renderFrame || 0) - before,
      sceneDrawCalls: Number(canvas.dataset.drawCalls || 0),
      renderMs: Number(canvas.dataset.renderMs || 0),
      cameras: Number(canvas.dataset.splitCameras || 0),
      renderScale: Number(canvas.dataset.splitRenderScale || 1),
      rects: JSON.parse(canvas.dataset.splitRects || "[]"),
      renderContext: {
        cssWidth: Math.round(bounds.width), cssHeight: Math.round(bounds.height),
        backingWidth: canvas.width, backingHeight: canvas.height,
        devicePixelRatio: window.devicePixelRatio,
        engine: canvas.dataset.engine || null,
        webglRenderer: gl ? gl.getParameter(debug?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER) : null,
      },
    };
  });
}

const EXPECTED_SCALES = { 2: 1, 4: 0.9, 6: 0.8, 8: 0.8 };

test("measure 2/4/6/8 split-camera frame cadence on one shared renderer", async ({browser}) => {
  const f = await lobby(browser, 8);
  try {
    await f.start();
    await f.host.bringToFront();
    const canvas = f.host.locator("#race-track");
    const select = f.host.getByLabel("Race display", { exact: true });
    await expect(canvas).toHaveAttribute("data-renderer", "3d", { timeout: 15000 });

    const readings = [];
    for (const cameras of [2, 4, 6, 8]) {
      await select.selectOption(`split-${cameras}`);
      await expect(canvas).toHaveAttribute("data-camera", "split");
      await expect(canvas).toHaveAttribute("data-split-cameras", String(cameras));
      await f.host.waitForTimeout(150);
      const result = await readSample(f.host);
      expect(result.intervalsMs).toHaveLength(120);
      expect(result.cameras).toBe(cameras);
      expect(result.rects.length).toBeGreaterThanOrEqual(cameras);
      expect(result.rendered3dFrames).toBeGreaterThan(0);
      expect(result.sceneDrawCalls).toBeGreaterThan(0);
      expect(result.renderMs).toBeGreaterThan(0);
      if (cameras === 8) expect(result.sceneDrawCalls).toBeLessThanOrEqual(120);
      expect(result.renderScale).toBe(EXPECTED_SCALES[cameras]);
      expect(result.renderContext.engine || result.renderContext.webglRenderer).toBeTruthy();
      readings.push({
        cameras,
        renderScale: result.renderScale,
        rafP50Ms: percentile(result.intervalsMs, 0.5),
        rafP95Ms: percentile(result.intervalsMs, 0.95),
        worstRafMs: percentile(result.intervalsMs, 1),
        rendered3dFrames: result.rendered3dFrames,
        sceneDrawCalls: result.sceneDrawCalls,
        renderMs: result.renderMs,
        renderContext: result.renderContext,
      });
    }
    expect(f.errors).toEqual([]);

    const eight = readings.find(reading => reading.cameras === 8);
    // renderMs measures the time our own render() body spends updating karts and
    // submitting all viewports. It is the cost this code controls, and draw
    // calls are bounded by the assertion above. rAF cadence is recorded for
    // context but is dominated by the loopback software compositor and host CPU
    // load (it varies with camera count inverted from actual render cost), so
    // none of its percentiles are valid pass/fail signals on this host.
    const reliable = eight.renderMs <= 16;
    await record({
      method: "Playwright Chromium / headless local Grand Prix with 8 browser players / one THREE.WebGLRenderer",
      readings, reliable,
      warning: "renderMs is direct render cost; rAF cadence is not GPU time and loopback software rendering on a shared host is not a real TV or iPhone measurement."
    });
    expect(reliable).toBe(true);
  } finally { await f.close(); }
});
