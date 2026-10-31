import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { lobby } from "../browser-specs/helpers/race-lobby.js";

const percentile = (values, fraction) => {
  if (!values.length) return null;
  const ordered = [...values].sort((a, b) => a - b);
  return Math.round(ordered[Math.ceil(ordered.length * fraction) - 1] * 100) / 100;
};
async function record(filename, report) {
  await mkdir("performance-results", { recursive: true });
  await writeFile("performance-results/" + filename, JSON.stringify(report, null, 2) + "\n");
  console.log("MEASURED_PERFORMANCE=" + JSON.stringify(report));
}

test("measure three cold local party-page loads and socket readiness", async ({ browser }) => {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await page.goto("http://127.0.0.1:4317/", { waitUntil: "load" });
      await expect(page.locator("#status")).toHaveText("Connected.");
      const sample = await page.evaluate(() => {
        const nav = performance.getEntriesByType("navigation")[0];
        return {
          responseEndMs: nav.responseEnd,
          domContentLoadedMs: nav.domContentLoadedEventEnd,
          loadEventEndMs: nav.loadEventEnd,
          observedConnectedAtMs: performance.now(),
          resourceCount: performance.getEntriesByType("resource").length
        };
      });
      expect(sample.loadEventEndMs).toBeGreaterThan(0);
      expect(sample.observedConnectedAtMs).toBeGreaterThanOrEqual(sample.loadEventEndMs);
      samples.push(sample);
    } finally { await context.close(); }
  }
  await record("party-page-loading.json", {
    method: "Playwright Chromium GitHub runner / fresh browser contexts / local guest server",
    samples, medianLoadMs: percentile(samples.map(x => x.loadEventEndMs), 0.5),
    medianObservedSocketReadyMs: percentile(samples.map(x => x.observedConnectedAtMs), 0.5),
    warning: "Loopback/browser-polling timings are not live Render or mobile network timings."
  });
});

async function readFrames(page) {
  return page.evaluate(async () => {
    const canvas = document.querySelector("#race-track");
    const mode = canvas.dataset.renderer;
    const before = mode === "3d" ? Number(canvas.dataset.renderFrame || 0) : null;
    const calls = mode === "3d" ? Number(canvas.dataset.drawCalls || 0) : null;
    // Identify software rasterizers vs hardware-backed WebGL, and record
    // the actual backing buffer resolution used for this sample.
    const gl = mode === "3d" ? canvas.getContext("webgl2") : null;
    const debug = gl?.getExtension("WEBGL_debug_renderer_info");
    const bounds = canvas.getBoundingClientRect();
    const renderContext = {
      cssWidth: Math.round(bounds.width), cssHeight: Math.round(bounds.height),
      backingWidth: canvas.width, backingHeight: canvas.height,
      devicePixelRatio: window.devicePixelRatio,
      webglVendor: gl ? gl.getParameter(debug?.UNMASKED_VENDOR_WEBGL ?? gl.VENDOR) : null,
      webglRenderer: gl ? gl.getParameter(debug?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER) : null
    };
    const intervalsMs = [];
    await new Promise(resolve => {
      let prior = null, steps = 0;
      function tick(time) {
        if (prior !== null) intervalsMs.push(time - prior);
        prior = time;
        if (++steps === 121) resolve();
        else requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
    const after = mode === "3d" ? Number(canvas.dataset.renderFrame || 0) : null;
    const threeDBundle = performance.getEntriesByType("resource")
      .filter(e => e.name.endsWith("/race-3d.bundle.js"))
      .map(e => ({ durationMs: e.duration, transferSize: e.transferSize, decodedBodySize: e.decodedBodySize }));
    return { mode, intervalsMs, rendered3dFrames: mode === "3d" ? after - before : null, sceneDrawCalls: calls, renderContext, threeDBundle };
  });
}
test("measure real Grand Prix 3D, 2D and 3D browser frame cadence", async ({ browser }) => {
  const f = await lobby(browser, 2);
  try {
    await f.start();
    await f.host.bringToFront();
    await expect(f.host.locator("#race-track")).toHaveAttribute("data-renderer", "3d", { timeout: 15000 });
    const readings = [];
    for (const mode of ["3d", "2d", "3d"]) {
      if (await f.host.locator("#race-track").getAttribute("data-renderer") !== mode) {
        const label = mode === "2d" ? "Use 2D view" : "Use 3D view";
        await f.host.getByRole("button", { name: label, exact: true }).click();
        await expect(f.host.locator("#race-track")).toHaveAttribute("data-renderer", mode, { timeout: 15000 });
      }
      const result = await readFrames(f.host);
      expect(result.mode).toBe(mode);
      expect(result.intervalsMs).toHaveLength(120);
      if (mode === "3d") {
        expect(result.rendered3dFrames).toBeGreaterThan(0);
        expect(result.sceneDrawCalls).toBeGreaterThan(0);
        expect(result.renderContext.backingWidth).toBeGreaterThan(0);
        expect(result.renderContext.webglRenderer).toBeTruthy();
      }
      readings.push({
        mode, rafP50Ms: percentile(result.intervalsMs, 0.5),
        rafP95Ms: percentile(result.intervalsMs, 0.95),
        worstRafMs: percentile(result.intervalsMs, 1),
        rendered3dFrames: result.rendered3dFrames,
        sceneDrawCalls: result.sceneDrawCalls,
        renderContext: result.renderContext,
        threeDBundle: result.threeDBundle
      });
    }
    expect(f.errors).toEqual([]);
    await record("grand-prix-rendering.json", {
      method: "Playwright Chromium / headless Ubuntu / real local Grand Prix with 2 browser players",
      readings,
      warning: "rAF cadence is not GPU execution time. Renderer/vendor and buffer dimensions are diagnostic context; masked renderer strings may not identify hardware. 2D has no independent draw count; real Windows hardware may differ."
    });
  } finally { await f.close(); }
});
