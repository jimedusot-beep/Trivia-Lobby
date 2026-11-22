import test from 'node:test';
import assert from 'node:assert/strict';
import { splitRenderScale, SPLIT_RENDER_SCALES } from '../render/race-render-scale.js';

test('small split grids keep more pixels while eight cameras stay at the guarded scale', () => {
  assert.equal(SPLIT_RENDER_SCALES[1], 1);
  assert.equal(SPLIT_RENDER_SCALES[2], 1);
  assert.equal(SPLIT_RENDER_SCALES[3], 0.9);
  assert.equal(SPLIT_RENDER_SCALES[4], 0.9);
  for (let count = 5; count <= 8; count++) assert.equal(SPLIT_RENDER_SCALES[count], 0.8);
  for (let count = 1; count <= 8; count++) assert.equal(splitRenderScale(count), SPLIT_RENDER_SCALES[count]);
});

test('shared views and reduced motion always use full resolution', () => {
  assert.equal(splitRenderScale(0), 1);
  assert.equal(splitRenderScale(8, true), 1);
  assert.equal(splitRenderScale(4, true), 1);
  assert.equal(splitRenderScale(NaN), 1);
  assert.equal(splitRenderScale(9), 1);
});
