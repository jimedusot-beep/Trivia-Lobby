import test from 'node:test';
import assert from 'node:assert/strict';
import { getSplitLayout } from '../render/race-split-layout.js';
import { renderSplitViewports } from '../render/race-viewport-render.js';

function fakeRenderer(perRenderCalls = 7) {
  const operations = [];
  return {
    operations,
    info: { render: { calls: perRenderCalls } },
    setViewport(...args) { operations.push({ op: 'viewport', args }); },
    setScissor(...args) { operations.push({ op: 'scissor', args }); },
    setScissorTest(value) { operations.push({ op: 'scissorTest', args: [value] }); },
    render(_scene, camera) { operations.push({ op: 'render', camera }); },
  };
}
function fakeCamera() {
  return { aspect: 1, updates: 0, updateProjectionMatrix() { this.updates++; } };
}
function viewsFor(count, width, height) {
  return getSplitLayout(count, width, height).cells.map(cell => ({ rect: cell, camera: fakeCamera() }));
}
const ops = (renderer, op) => renderer.operations.filter(entry => entry.op === op);

test('two-player split renders two scissored viewports and restores full-canvas state', () => {
  const renderer = fakeRenderer(), scene = {}, views = viewsFor(2, 1200, 720);
  const calls = renderSplitViewports(renderer, scene, views, 1200, 720);

  assert.deepEqual(ops(renderer, 'render').map(entry => entry.camera), views.map(view => view.camera));
  assert.deepEqual(ops(renderer, 'viewport').slice(0, 2).map(entry => entry.args), [
    [0, 0, 600, 720],
    [600, 0, 600, 720],
  ]);
  assert.deepEqual(ops(renderer, 'scissor').slice(0, 2).map(entry => entry.args), [
    [0, 0, 600, 720],
    [600, 0, 600, 720],
  ]);
  assert.deepEqual(ops(renderer, 'scissorTest').map(entry => entry.args), [[true], [false]]);
  assert.deepEqual(ops(renderer, 'viewport').at(-1).args, [0, 0, 1200, 720]);
  assert.deepEqual(ops(renderer, 'scissor').at(-1).args, [0, 0, 1200, 720]);
  assert.equal(calls, 14);
  assert.ok(views.every(view => view.camera.aspect === 600 / 720));
  assert.ok(views.every(view => view.camera.updates === 1));
});

test('four-player viewports use top-origin CSS converted to bottom-origin WebGL rectangles', () => {
  const renderer = fakeRenderer(), views = viewsFor(4, 1200, 720);
  renderSplitViewports(renderer, {}, views, 1200, 720);
  assert.deepEqual(ops(renderer, 'viewport').slice(0, 4).map(entry => entry.args), [
    [0, 360, 600, 360],
    [600, 360, 600, 360],
    [0, 0, 600, 360],
    [600, 0, 600, 360],
  ]);
});

test('camera projection updates only when the viewport aspect actually changes', () => {
  const renderer = fakeRenderer(), views = viewsFor(2, 1200, 720);
  views[0].camera.aspect = 600 / 720;
  renderSplitViewports(renderer, {}, views, 1200, 720);
  assert.equal(views[0].camera.updates, 0);
  assert.equal(views[1].camera.updates, 1);
});
