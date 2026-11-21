// SPDX-License-Identifier: AGPL-3.0-or-later
// Failing-first two-player Driver POV contract. Runs only in the disposable copy.
import { test, expect } from '@playwright/test';
import { PNG } from 'pngjs';
import { lobby } from './helpers/race-lobby.js';

function installRenderDiagnostics() {
  const diag = { calls: [], visibility: [], throwNextDraw: false, values: new WeakMap() };
  window.__driverPovDiag = diag;
  const contexts = [window.WebGLRenderingContext, window.WebGL2RenderingContext].filter(Boolean);
  for (const Context of contexts) {
    for (const name of ['enable', 'disable', 'viewport', 'scissor']) {
      const original = Context.prototype[name];
      if (typeof original !== 'function') continue;
      Context.prototype[name] = function (...args) {
        diag.calls.push({ name, args: Array.from(args) });
        return original.apply(this, args);
      };
    }
    for (const name of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) {
      const original = Context.prototype[name];
      if (typeof original !== 'function') continue;
      Context.prototype[name] = function (...args) {
        if (diag.throwNextDraw) {
          diag.throwNextDraw = false;
          diag.calls.push({ name: 'INJECTED_THROW', args: [] });
          diag.visibility.push({ marker: 'THROW' });
          throw new Error('injected renderer failure');
        }
        return original.apply(this, args);
      };
    }
  }
  Object.defineProperty(Object.prototype, 'visible', {
    configurable: true,
    get() { return diag.values.get(this); },
    set(value) {
      diag.values.set(this, value);
      if (this && this.isObject3D) diag.visibility.push({ uuid: this.uuid, value });
    },
  });
}

const rgb = value => [1, 3, 5].map(index => parseInt(value.slice(index, index + 2), 16));
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const BACKGROUND = rgb('#c5e6ec');
const ROAD = rgb('#46536c');

async function hideOverlays(page) {
  await page.evaluate(() => {
    for (const selector of ['.race-split-root', '.race-clock', '.race-caption', '.race-grid']) {
      for (const node of document.querySelectorAll(selector)) node.style.visibility = 'hidden';
    }
  });
}

async function renderedPixels(page) {
  const canvas = page.locator('#race-track');
  await hideOverlays(page);
  const before = Number(await canvas.getAttribute('data-render-frame'));
  await expect.poll(async () => Number(await canvas.getAttribute('data-render-frame'))).toBeGreaterThan(before);
  const meta = await canvas.evaluate(node => {
    const gl = node.getContext('webgl2') || node.getContext('webgl');
    const debug = gl?.getExtension('WEBGL_debug_renderer_info');
    return {
      engine: node.dataset.engine || node.dataset.renderer,
      renderer: gl ? gl.getParameter(debug?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER) : null,
      camera: node.dataset.camera,
      frame: Number(node.dataset.renderFrame),
    };
  });
  return { png: PNG.sync.read(await canvas.screenshot()), meta };
}

function halfStats(png, start, end) {
  let count = 0, nonBackground = 0, road = 0;
  const colors = new Set();
  for (let y = 0; y < png.height; y += 4) for (let x = start; x < end; x += 4) {
    const index = (png.width * y + x) * 4;
    const pixel = [png.data[index], png.data[index + 1], png.data[index + 2]];
    count++;
    colors.add(`${pixel[0] >> 4},${pixel[1] >> 4},${pixel[2] >> 4}`);
    if (distance(pixel, BACKGROUND) > 40) nonBackground++;
    if (distance(pixel, ROAD) < 55) road++;
  }
  return {
    samples: count,
    colors: colors.size,
    nonBackground: +(nonBackground / count).toFixed(3),
    road: +(road / count).toFixed(3),
  };
}

function imageDifference(a, b) {
  if (a.width !== b.width || a.height !== b.height) return Infinity;
  let total = 0, samples = 0;
  for (let y = 0; y < a.height; y += 4) for (let x = 0; x < a.width; x += 4) {
    const index = (a.width * y + x) * 4;
    for (let channel = 0; channel < 3; channel++) {
      total += Math.abs(a.data[index + channel] - b.data[index + channel]);
      samples++;
    }
  }
  return +(total / samples).toFixed(2);
}

function splitHalfDifference(png) {
  const mid = Math.floor(png.width / 2);
  let total = 0, samples = 0;
  for (let y = 0; y < png.height; y += 4) for (let x = 0; x < mid; x += 4) {
    const left = (png.width * y + x) * 4, right = (png.width * y + mid + x) * 4;
    for (let channel = 0; channel < 3; channel++) {
      total += Math.abs(png.data[left + channel] - png.data[right + channel]);
      samples++;
    }
  }
  return +(total / samples).toFixed(2);
}

test('two-player Driver POV renders real WebGL views, returns to Whole Track and restores render state', async ({ browser, browserName }) => {
  test.skip(browserName !== 'chromium', 'Real WebGL and context-state assertions are Chromium-only.');
  const f = await lobby(browser, 2, undefined, installRenderDiagnostics);
  try {
    await f.start();
    const canvas = f.host.locator('#race-track');
    const select = f.host.getByLabel('Race display', { exact: true });
    await expect(canvas).toHaveAttribute('data-renderer', '3d', { timeout: 15000 });
    await expect(canvas, 'Three.js records its engine on the shared canvas').toHaveAttribute('data-engine', /three\.js/);

    const option = select.locator('option[value="driver-pov"]');
    await expect(option, 'the display menu must expose two-player Driver POV').toHaveText(/Driver POV/);
    await select.selectOption('driver-pov');
    await expect(canvas).toHaveAttribute('data-camera', 'driver-pov');
    await expect(canvas).toHaveAttribute('data-split-cameras', '2');
    await expect(canvas).toHaveAttribute('data-split-numbers', '1,2');
    await expect(f.host.locator('.race-split-hud:visible')).toHaveCount(2);
    expect(await f.host.locator('.race-split-hud:visible').evaluateAll(nodes => nodes.map(node => node.dataset.player)))
      .toEqual(['1', '2']);

    const visibleRaw = await canvas.getAttribute('data-driver-pov-visible-karts');
    expect(visibleRaw, 'each POV must report the karts rendered in that view').toBeTruthy();
    expect(JSON.parse(visibleRaw)).toEqual([[2], [1]], 'each driver must see rivals only, never its own kart');

    const pov = await renderedPixels(f.host);
    expect(pov.meta.engine).toContain('three.js');
    expect(pov.meta.renderer).toBeTruthy();
    const mid = Math.floor(pov.png.width / 2);
    const left = halfStats(pov.png, 0, mid);
    const right = halfStats(pov.png, mid, pov.png.width);
    for (const [name, stats] of [['left', left], ['right', right]]) {
      expect(stats.colors, `${name} POV must contain real rendered geometry`).toBeGreaterThan(80);
      expect(stats.nonBackground, `${name} POV must not be a blank clear color`).toBeGreaterThan(0.4);
      expect(stats.road, `${name} POV must look along the road rather than at a nearby kart`).toBeGreaterThan(0.15);
    }
    expect(splitHalfDifference(pov.png), 'the two POVs must show different karts').toBeGreaterThan(5);

    await select.selectOption('whole');
    await expect(canvas).toHaveAttribute('data-camera', 'overview');
    await expect(canvas).toHaveAttribute('data-split-cameras', '0');
    await expect(f.host.locator('.race-split-hud:visible')).toHaveCount(0);
    for (const attribute of ['data-split-rects', 'data-split-visible-karts', 'data-driver-pov-visible-karts']) {
      await expect(canvas, `${attribute} must not outlive split mode`).not.toHaveAttribute(attribute);
    }
    const whole = await renderedPixels(f.host);
    expect(whole.meta.renderer).toBeTruthy();
    expect(halfStats(whole.png, 0, whole.png.width).colors).toBeGreaterThan(80);
    expect(imageDifference(pov.png, whole.png), 'Whole Track must still be a distinct selectable view').toBeGreaterThan(5);

    await select.selectOption('driver-pov');
    await expect(canvas).toHaveAttribute('data-camera', 'driver-pov');
    const viewport = await canvas.evaluate(node => [node.width, node.height]);
    await f.host.evaluate(() => {
      const diag = window.__driverPovDiag;
      diag.calls.length = 0;
      diag.visibility.length = 0;
      diag.throwNextDraw = true;
    });
    await expect(canvas, 'an injected draw failure must take the documented 2D fallback').toHaveAttribute('data-renderer', '2d', { timeout: 10000 });
    const diag = await f.host.evaluate(() => ({
      calls: window.__driverPovDiag.calls,
      visibility: window.__driverPovDiag.visibility,
    }));
    const throwCall = diag.calls.findIndex(entry => entry.name === 'INJECTED_THROW');
    expect(throwCall, 'the injected WebGL draw failure must have fired').toBeGreaterThanOrEqual(0);
    const afterThrow = diag.calls.slice(throwCall + 1);
    const [width, height] = viewport;
    const scissorConstant = 0x0c11;
    expect(afterThrow.some(entry => entry.name === 'disable' && Number(entry.args[0]) === scissorConstant),
      'scissor test must be restored after a render failure').toBe(true);
    expect(afterThrow.some(entry => entry.name === 'viewport' &&
      Number(entry.args[0]) === 0 && Number(entry.args[1]) === 0 &&
      Number(entry.args[2]) === width && Number(entry.args[3]) === height),
      'full-canvas viewport must be restored after a render failure').toBe(true);
    expect(afterThrow.some(entry => entry.name === 'scissor' &&
      Number(entry.args[0]) === 0 && Number(entry.args[1]) === 0 &&
      Number(entry.args[2]) === width && Number(entry.args[3]) === height),
      'full-canvas scissor must be restored after a render failure').toBe(true);

    const throwVisibility = diag.visibility.findIndex(entry => entry.marker === 'THROW');
    expect(throwVisibility, 'the injected failure must land inside the split render').toBeGreaterThanOrEqual(0);
    const hiddenBefore = new Set(diag.visibility.slice(0, throwVisibility)
      .filter(entry => entry.value === false).map(entry => entry.uuid));
    const restoredVisible = diag.visibility.slice(throwVisibility + 1)
      .filter(entry => entry.value === true && hiddenBefore.has(entry.uuid));
    expect(restoredVisible.length,
      'temporary split visibility changes must be undone after a render failure').toBeGreaterThan(0);
    expect(f.errors).toEqual([]);
  } finally { await f.close(); }
});
