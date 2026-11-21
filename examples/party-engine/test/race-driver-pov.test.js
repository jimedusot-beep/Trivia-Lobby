// SPDX-License-Identifier: AGPL-3.0-or-later
// Failing-first contract for the proposed two-player Driver POV integration.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createFollowCameraStates,
  updateFollowCameras,
  DRIVER_POV_CAMERA,
} from '../render/race-follow-cameras.js';
import { splitVisibleKartNumbers } from '../render/race-kart-visibility.js';
import { renderSplitViewports } from '../render/race-viewport-render.js';

const kart = (number, x, y, angle = 0, rank = number) => ({ number, x, y, angle, rank });
const near = (actual, expected, tolerance, message) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: ${actual} !~ ${expected}`);

test('two Driver POV cameras keep kart identity and sit at each driver eye', () => {
  const states = createFollowCameraStates([1, 2]);
  // Reverse frame order and ranks: identity must still come from kart.number.
  updateFollowCameras(states, {
    karts: [kart(2, 700, 460, Math.PI / 2, 1), kart(1, 500, 260, 0, 2)],
  }, null, 1, DRIVER_POV_CAMERA);

  assert.deepEqual(states.map(state => state.number), [1, 2]);
  near(states[0].kartX, -10, 1e-6, 'camera 1 tracks kart 1');
  near(states[1].kartX, 10, 1e-6, 'camera 2 tracks kart 2');

  for (const state of states) {
    const offset = Math.hypot(state.x - state.kartX, state.z - state.kartZ);
    assert.ok(offset <= 0.35, `camera ${state.number} must sit at the driver eye, not behind the kart (offset ${offset})`);
    assert.ok(state.y >= 1.4 && state.y <= 2.2, `camera ${state.number} height ${state.y} must be at driver-eye level`);
    near(state.lookY, DRIVER_POV_CAMERA.lookHeight, 0.2, `camera ${state.number} look height`);
    assert.equal(state.visible, true);

    const facing = -state.angle;
    const forward = { x: Math.cos(facing), z: Math.sin(facing) };
    const look = { x: state.lookX - state.kartX, z: state.lookZ - state.kartZ };
    const along = look.x * forward.x + look.z * forward.z;
    const lateral = Math.abs(look.x * -forward.z + look.z * forward.x);
    assert.ok(along >= DRIVER_POV_CAMERA.lookAhead - 0.5,
      `camera ${state.number} must look forward along the kart heading (${along})`);
    assert.ok(lateral <= 0.5, `camera ${state.number} look target must not point sideways (${lateral})`);
  }
});

test('Driver POV hides the focus kart geometry while keeping nearest rivals', () => {
  const karts = [kart(1, 100, 100), kart(2, 104, 100), kart(3, 220, 220), kart(4, 240, 240)];
  const leftView = splitVisibleKartNumbers(karts, 1, { limit: 3, excludeFocus: true });
  const rightView = splitVisibleKartNumbers(karts, 2, { limit: 3, excludeFocus: true });

  assert.deepEqual(leftView, [2, 3], 'player 1 must not render its own kart in its POV');
  assert.deepEqual(rightView, [1, 3], 'player 2 must not render its own kart in its POV');
  assert.ok(!leftView.includes(1) && !rightView.includes(2));
});

test('a failed split viewport render restores scissor test, viewport and scissor', () => {
  const operations = [];
  const renderer = {
    info: { render: { calls: 5 } },
    setViewport(...args) { operations.push({ op: 'viewport', args }); },
    setScissor(...args) { operations.push({ op: 'scissor', args }); },
    setScissorTest(value) { operations.push({ op: 'scissorTest', args: [value] }); },
    render() { operations.push({ op: 'throw' }); throw new Error('injected renderer failure'); },
  };
  const camera = { aspect: 1, updateProjectionMatrix() {} };
  const views = [{ rect: { gl: { x: 0, y: 0, width: 300, height: 400 } }, camera }];

  assert.throws(() => renderSplitViewports(renderer, {}, views, 600, 400), /injected renderer failure/);
  const afterThrow = operations.slice(operations.findLastIndex(entry => entry.op === 'throw') + 1);
  assert.deepEqual(afterThrow.filter(entry => entry.op === 'scissorTest').map(entry => entry.args), [[false]]);
  assert.deepEqual(afterThrow.filter(entry => entry.op === 'viewport').map(entry => entry.args), [[0, 0, 600, 400]]);
  assert.deepEqual(afterThrow.filter(entry => entry.op === 'scissor').map(entry => entry.args), [[0, 0, 600, 400]]);
});
