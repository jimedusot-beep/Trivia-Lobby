import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createFollowCameraStates,
  updateFollowCameras,
  SPLIT_FOLLOW_CAMERA,
} from '../render/race-follow-cameras.js';

const near = (actual, expected, message) =>
  assert.ok(Math.abs(actual - expected) < 1e-6, `${message}: ${actual} !== ${expected}`);
const kart = (number, x, y, angle = 0, rank = number) => ({ number, x, y, angle, rank });

test('camera identity stays with player number when frame order and rank change', () => {
  const states = createFollowCameraStates([1, 2]);
  updateFollowCameras(states, { karts: [kart(2, 700, 360, 0, 1), kart(1, 500, 360, 0, 2)] }, null, 1, { smoothing: 1 });
  assert.equal(states[0].number, 1);
  assert.equal(states[1].number, 2);
  near(states[0].kartX, -10, 'player 1 follows x=500');
  near(states[1].kartX, 10, 'player 2 follows x=700');

  updateFollowCameras(states, { karts: [kart(1, 400, 360, 0, 2), kart(2, 800, 360, 0, 1)] }, null, 1, { smoothing: 1 });
  assert.equal(states[0].number, 1);
  assert.equal(states[1].number, 2);
  near(states[0].kartX, -20, 'player 1 still follows player 1');
  near(states[1].kartX, 20, 'player 2 still follows player 2');
});

test('following cameras sit behind the kart and look ahead along its direction', () => {
  const states = createFollowCameraStates([1]);
  updateFollowCameras(states, { karts: [kart(1, 600, 360, 0)] }, null, 1, { smoothing: 1 });
  near(states[0].x, -10, 'camera x behind kart');
  near(states[0].y, 6.3, 'camera height');
  near(states[0].z, 0, 'camera z');
  near(states[0].lookX, 5, 'look target x ahead');
  near(states[0].lookY, 0.8, 'look target height');
  near(states[0].lookZ, 0, 'look target z');
  assert.equal(states[0].visible, true);
});

test('split cameras sit closer and lower for small viewport cells', () => {
  const states = createFollowCameraStates([1]);
  updateFollowCameras(states, { karts: [kart(1, 600, 360, 0)] }, null, 1,
    { ...SPLIT_FOLLOW_CAMERA, smoothing: 1 });
  near(states[0].x, -8, 'split camera x is closer to the kart');
  near(states[0].y, 5.2, 'split camera height is lower');
  near(states[0].lookX, 4, 'split look target is nearer');
  near(states[0].lookY, 0.7, 'split look target is lower');
  assert.equal(states[0].visible, true);
});

test('authoritative frames are interpolated without re-keying cameras', () => {
  const states = createFollowCameraStates([1]);
  const previous = { karts: [kart(1, 500, 360)] };
  const frame = { karts: [kart(1, 700, 360)] };
  updateFollowCameras(states, frame, previous, 0.5, { smoothing: 1 });
  near(states[0].kartX, 0, 'interpolated kart x');
  near(states[0].x, -10, 'camera follows interpolated position');
});

test('a missing kart keeps its last camera pose and is marked invisible', () => {
  const states = createFollowCameraStates([1]);
  updateFollowCameras(states, { karts: [kart(1, 700, 360)] }, null, 1, { smoothing: 1 });
  const lastX = states[0].x;
  updateFollowCameras(states, { karts: [] }, null, 1, { smoothing: 1 });
  assert.equal(states[0].visible, false);
  near(states[0].x, lastX, 'last camera pose is retained');
});
