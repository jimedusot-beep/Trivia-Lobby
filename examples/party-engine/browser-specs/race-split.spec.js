import { test, expect } from '@playwright/test';
import { lobby } from './helpers/race-lobby.js';

const GRIDS = {
  1: [1, 1], 2: [2, 1], 3: [2, 2], 4: [2, 2],
  5: [3, 2], 6: [3, 2], 7: [3, 3], 8: [3, 3],
};
const SCALES = { 1: '1', 2: '1', 3: '0.9', 4: '0.9', 5: '0.8', 6: '0.8', 7: '0.8', 8: '0.8' };
const near = (actual, expected) => expect(Math.abs(actual - expected)).toBeLessThan(3);

// Firefox CI runs without WebGL, so split-screen falls back to the shared 2D view.
// Real split rendering stays covered in Chromium and WebKit.
test.beforeEach(({browserName}) => {
  test.skip(browserName === 'firefox', 'Split-screen 3D rendering requires WebGL.');
});

test('one through eight local cameras use the required grid, HUD and standings', async ({browser}) => {
  // Nine live WebGL pages render eight successive split layouts. This takes ~31s
  // locally and exceeds the shared 60s limit on slower cross-browser CI runners.
  test.setTimeout(180000);
  const f = await lobby(browser, 8);
  try {
    await f.start();
    const canvas = f.host.locator('#race-track');
    const select = f.host.getByLabel('Race display', { exact: true });
    await expect(canvas).toHaveAttribute('data-renderer', '3d', { timeout: 15000 });
    await expect(canvas).toHaveAttribute('data-karts', '8');
    const wholeCallsBefore = Number(await canvas.getAttribute('data-draw-calls'));
    expect(wholeCallsBefore).toBeGreaterThan(0);

    for (let count = 1; count <= 8; count++) {
      await select.selectOption(`split-${count}`);
      await expect(canvas).toHaveAttribute('data-camera', 'split');
      await expect(canvas).toHaveAttribute('data-split-cameras', String(count));
      await expect(canvas).toHaveAttribute('data-split-render-scale', SCALES[count]);
      await expect(canvas).toHaveAttribute('aria-label', /split-screen race/);
      await expect(f.host.locator('.race-split-hud[data-player="1"]'))
        .toHaveAttribute('aria-label', 'Camera for player 1');
      const visible = (await canvas.getAttribute('data-split-visible-karts') || '').split(',').map(Number).filter(Boolean);
      expect(visible[0]).toBe(1);
      expect(visible.length).toBeLessThanOrEqual(4);

      const rects = JSON.parse(await canvas.getAttribute('data-split-rects'));
      expect(rects).toHaveLength(GRIDS[count][0] * GRIDS[count][1]);
      const huds = f.host.locator('.race-split-hud:visible');
      await expect(huds).toHaveCount(count);
      expect(await huds.evaluateAll(nodes => nodes.map(node => node.dataset.player)))
        .toEqual(Array.from({ length: count }, (_, index) => String(index + 1)));
      await expect(f.host.locator('.race-split-status:visible'))
        .toHaveText(Array(count).fill('ITEM · PHONE'));
      await expect(f.host.locator('.race-split-standings:visible'))
        .toHaveCount(count === 7 ? 2 : count === 8 ? 1 : 0);

      const box = await canvas.boundingBox();
      const [columns, rows] = GRIDS[count];
      for (let index = 0; index < count; index++) {
        const cell = await f.host.locator(`.race-split-hud[data-player="${index + 1}"]`).boundingBox();
        near(cell.x, box.x + (index % columns) * box.width / columns);
        near(cell.y, box.y + Math.floor(index / columns) * box.height / rows);
        near(cell.width, box.width / columns);
        near(cell.height, box.height / rows);
      }

      const calls = Number(await canvas.getAttribute('data-draw-calls'));
      expect(calls).toBeGreaterThan(0);

      if (process.env.RACE_SCREENSHOT_DIR) {
        const { mkdir } = await import('node:fs/promises');
        await mkdir(process.env.RACE_SCREENSHOT_DIR, { recursive: true });
        await f.host.locator('.race-game').screenshot({ path: `${process.env.RACE_SCREENSHOT_DIR}/party-grand-prix-split-${count}.png` });
      }
    }

    await select.selectOption('whole');
    await expect(canvas).toHaveAttribute('data-camera', 'overview');
    await expect(canvas).toHaveAttribute('data-split-render-scale', '1');
    await expect(canvas).toHaveAttribute('aria-label', /overhead race track/);
    await expect(f.host.locator('.race-split-hud:visible')).toHaveCount(0);
    const wholeCallsAfter = Number(await canvas.getAttribute('data-draw-calls'));
    expect(wholeCallsAfter).toBeGreaterThanOrEqual(wholeCallsBefore - 5);
    expect(f.errors).toEqual([]);
  } finally { await f.close(); }
});

test('reduced motion forces the whole track even from a split view', async ({browser}) => {
  const f = await lobby(browser, 4);
  try {
    await f.start();
    const canvas = f.host.locator('#race-track');
    const select = f.host.getByLabel('Race display', { exact: true });
    await expect(canvas).toHaveAttribute('data-renderer', '3d', { timeout: 15000 });
    await select.selectOption('split-4');
    await expect(canvas).toHaveAttribute('data-camera', 'split');
    await expect(f.host.locator('.race-split-hud:visible')).toHaveCount(4);

    await f.host.emulateMedia({ reducedMotion: 'reduce' });
    await expect(canvas).toHaveAttribute('data-camera', 'overview');
    await expect(canvas).toHaveAttribute('data-split-cameras', '0');
    await expect(select).toBeDisabled();
    await expect(f.host.locator('.race-split-hud:visible')).toHaveCount(0);
    await expect(f.host.locator('.race-view-status')).toContainText('Reduced motion · Whole Track');
    expect(f.errors).toEqual([]);
  } finally { await f.close(); }
});

test('nine or more racers keep the shared whole-track broadcast', async ({browser}) => {
  const f = await lobby(browser, 9);
  try {
    await f.start();
    const canvas = f.host.locator('#race-track');
    const select = f.host.getByLabel('Race display', { exact: true });
    await expect(canvas).toHaveAttribute('data-renderer', '3d', { timeout: 15000 });
    await expect(canvas).toHaveAttribute('data-camera', 'overview');
    await expect(select.locator('option[value="split-8"]')).toHaveAttribute('disabled', '');
    await expect(f.host.locator('.race-split-hud:visible')).toHaveCount(0);
    await expect(f.host.locator('.race-view-status')).toContainText('Nine or more racers · Whole Track');
    expect(f.errors).toEqual([]);
  } finally { await f.close(); }
});

test('split overlays realign after the host viewport changes', async ({browser}) => {
  const f = await lobby(browser, 4, { width: 1024, height: 768 });
  try {
    await f.start();
    const canvas = f.host.locator('#race-track');
    const select = f.host.getByLabel('Race display', { exact: true });
    await expect(canvas).toHaveAttribute('data-renderer', '3d', { timeout: 15000 });
    await select.selectOption('split-4');
    await expect(canvas).toHaveAttribute('data-camera', 'split');
    const initialWidth = Number(await canvas.getAttribute('data-split-canvas-width'));
    const initialRects = await canvas.getAttribute('data-split-rects');
    expect(JSON.parse(initialRects)).toHaveLength(4);

    await f.host.setViewportSize({ width: 720, height: 600 });
    await expect.poll(async () => Number(await canvas.getAttribute('data-split-canvas-width')))
      .toBeLessThan(initialWidth);
    await expect.poll(async () => await canvas.getAttribute('data-split-rects'))
      .not.toBe(initialRects);
    await expect(canvas).toHaveAttribute('data-split-render-scale', '0.9');

    const box = await canvas.boundingBox();
    await expect(f.host.locator('.race-split-hud:visible')).toHaveCount(4);
    for (let index = 0; index < 4; index++) {
      const cell = await f.host.locator(`.race-split-hud[data-player="${index + 1}"]`).boundingBox();
      near(cell.x, box.x + (index % 2) * box.width / 2);
      near(cell.y, box.y + Math.floor(index / 2) * box.height / 2);
      near(cell.width, box.width / 2);
      near(cell.height, box.height / 2);
    }
    expect(f.errors).toEqual([]);
  } finally { await f.close(); }
});

test('WebGL context loss in split view clears overlays without leaving the party', async ({browser,browserName}) => {
  test.skip(browserName !== 'chromium', 'WebGL loss extension is verified in Chromium.');
  const f = await lobby(browser, 4);
  try {
    await f.start();
    const canvas = f.host.locator('#race-track');
    const select = f.host.getByLabel('Race display', { exact: true });
    await expect(canvas).toHaveAttribute('data-renderer', '3d', { timeout: 15000 });
    await select.selectOption('split-4');
    await expect(canvas).toHaveAttribute('data-camera', 'split');
    await expect(f.host.locator('.race-split-hud:visible')).toHaveCount(4);
    const room = await f.host.locator('#heading').innerText();

    const lost = await canvas.evaluate(c => {
      const gl = c.getContext('webgl2');
      const ext = gl?.getExtension('WEBGL_lose_context');
      if (!ext) return false;
      ext.loseContext();
      return true;
    });
    expect(lost).toBe(true);
    await expect(canvas).toHaveAttribute('data-renderer', '2d');
    await expect(f.host.locator('.race-view-status')).toContainText('Racing continues in 2D');
    await expect(f.host.locator('.race-split-hud:visible')).toHaveCount(0);
    await expect(f.host.locator('.race-split-standings:visible')).toHaveCount(0);
    await expect(f.host.locator('#heading')).toHaveText(room);
    await expect(f.players[0].locator('#race-own-place')).toContainText('/ 4');
    expect(f.errors).toEqual([]);
  } finally { await f.close(); }
});

test('eight-way overlays remain legible and contained on a small host', async ({browser}) => {
  const f = await lobby(browser, 8);
  try {
    await f.start();
    await f.host.setViewportSize({ width: 900, height: 600 });
    const canvas = f.host.locator('#race-track');
    const select = f.host.getByLabel('Race display', { exact: true });
    await expect(canvas).toHaveAttribute('data-renderer', '3d', { timeout: 15000 });
    await select.selectOption('split-8');
    await expect(canvas).toHaveAttribute('data-camera', 'split');
    await expect(f.host.locator('.race-split-hud:visible')).toHaveCount(8);
    await expect(f.host.locator('.race-split-standings:visible .race-split-standings-list li')).toHaveCount(8);

    const huds = await f.host.locator('.race-split-hud:visible').evaluateAll(nodes => nodes.map(node => {
      const fields = [...node.querySelectorAll('.race-split-rank,.race-split-lap,.race-split-effect,.race-split-status')];
      return {
        font: parseFloat(getComputedStyle(node).fontSize),
        clippedX: node.scrollWidth - node.clientWidth,
        clippedY: node.scrollHeight - node.clientHeight,
        textClipped: fields.some(field => field.scrollWidth > field.clientWidth + 1),
        item: node.querySelector('.race-split-status')?.textContent || '',
        rank: node.querySelector('.race-split-rank')?.textContent || '',
        lap: node.querySelector('.race-split-lap')?.textContent || '',
      };
    }));
    expect(huds).toHaveLength(8);
    for (const hud of huds) {
      expect(hud.font).toBeGreaterThanOrEqual(10);
      expect(hud.clippedX).toBeLessThanOrEqual(1);
      expect(hud.clippedY).toBeLessThanOrEqual(1);
      expect(hud.textClipped).toBe(false);
      expect(hud.item).toBe('ITEM · PHONE');
      expect(hud.rank).toMatch(/\d/);
      expect(hud.lap).toMatch(/Lap \d/);
    }

    const standings = await f.host.locator('.race-split-standings:visible').evaluate(node => ({
      font: parseFloat(getComputedStyle(node).fontSize),
      clippedY: node.scrollHeight - node.clientHeight,
      rows: node.querySelectorAll('.race-split-standings-list li').length,
    }));
    expect(standings.font).toBeGreaterThanOrEqual(10);
    expect(standings.clippedY).toBeLessThanOrEqual(1);
    expect(standings.rows).toBe(8);
    expect(f.errors).toEqual([]);
  } finally { await f.close(); }
});

test('repeated display switching keeps one canvas and live overlays', async ({browser}) => {
  const f = await lobby(browser, 6);
  try {
    await f.start();
    const canvas = f.host.locator('#race-track');
    const select = f.host.getByLabel('Race display', { exact: true });
    await expect(canvas).toHaveAttribute('data-renderer', '3d', { timeout: 15000 });

    for (let cycle = 0; cycle < 3; cycle++) {
      await select.selectOption('split-6');
      await expect(canvas).toHaveAttribute('data-camera', 'split');
      await expect(canvas).toHaveAttribute('data-split-cameras', '6');
      await expect(f.host.locator('.race-split-hud:visible')).toHaveCount(6);

      await select.selectOption('whole');
      await expect(canvas).toHaveAttribute('data-camera', 'overview');
      await expect(f.host.locator('.race-split-hud:visible')).toHaveCount(0);

      await select.selectOption('director');
      await expect(canvas).toHaveAttribute('data-camera', 'director');
      await expect(f.host.locator('.race-minimap:visible')).toHaveCount(1);
      await expect(f.host.locator('.race-split-hud:visible')).toHaveCount(0);
    }

    await select.selectOption('whole');
    await expect(canvas).toHaveAttribute('data-camera', 'overview');
    await expect(f.host.locator('#race-track')).toHaveCount(1);
    await expect(f.host.locator('.race-screen canvas:visible')).toHaveCount(1);
    await expect(f.host.locator('.race-minimap:visible')).toHaveCount(0);
    const frames = Number(await canvas.getAttribute('data-render-frame'));
    await expect.poll(async () => Number(await canvas.getAttribute('data-render-frame'))).toBeGreaterThan(frames);
    expect(f.errors).toEqual([]);
  } finally { await f.close(); }
});

test('split cameras never exceed a small actual roster', async ({browser}) => {
  const f = await lobby(browser, 3);
  try {
    await f.start();
    const canvas = f.host.locator('#race-track');
    const select = f.host.getByLabel('Race display', { exact: true });
    await expect(canvas).toHaveAttribute('data-renderer', '3d', { timeout: 15000 });
    for (const count of [4, 5, 6, 7, 8]) {
      await expect(select.locator(`option[value="split-${count}"]`)).toHaveAttribute('disabled', '');
    }
    await expect(select.locator('option[value="split-3"]')).not.toHaveAttribute('disabled', '');

    // A stale or forged selection must still clamp to the authoritative roster.
    await select.evaluate(element => {
      element.value = 'split-8';
      element.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await expect(select).toHaveValue('split-3');
    await expect(canvas).toHaveAttribute('data-split-cameras', '3');
    await expect(f.host.locator('.race-split-hud:visible')).toHaveCount(3);
    await expect(canvas).toHaveAttribute('data-split-numbers', '1,2,3');
    const visible = (await canvas.getAttribute('data-split-visible-karts') || '').split(',').map(Number).filter(Boolean);
    expect(visible.length).toBeGreaterThan(0);
    expect(visible.every(number => number >= 1 && number <= 3)).toBe(true);
    expect(f.errors).toEqual([]);
  } finally { await f.close(); }
});
