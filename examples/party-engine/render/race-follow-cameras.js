// SPDX-License-Identifier: AGPL-3.0-or-later
// Pure following-camera maths. Camera identity is the authoritative kart number,
// never leaderboard rank. No DOM or Three.js dependency.
import { clamp, lerp, wrapAngle } from '../public/race-math.js';

const SCALE = 0.1;
const ORIGIN_X = 600;
const ORIGIN_Y = 360;
const CAMERA_BACK = 10;
const CAMERA_HEIGHT = 6.3;
const LOOK_AHEAD = 5;
const LOOK_HEIGHT = 0.8;
const DEFAULT_SMOOTHING = 0.22;

// Split cells are much smaller than the shared broadcast, so bring the camera
// closer and lower to keep the followed kart readable without changing the
// Whole Track or Race Director framing.
export const SPLIT_FOLLOW_CAMERA = Object.freeze({
  back: 8,
  height: 5.2,
  lookAhead: 4,
  lookHeight: 0.7,
  smoothing: 0.26,
});

// Two-player Driver POV sits at the driver's eye and looks down the road.
// Unlike the broadcast cameras, a zero offset is valid: the focus kart mesh is
// hidden, so the camera occupies the seat without clipping through the body.
export const DRIVER_POV_CAMERA = Object.freeze({
  back: 0,
  height: 1.75,
  lookAhead: 9,
  lookHeight: 0.35,
  smoothing: 1,
});

const option = (value, fallback, minimum = 0) =>
  Number.isFinite(value) && value >= minimum ? value : fallback;

export function createFollowCameraStates(numbers) {
  return numbers.map(number => ({
    number,
    visible: false,
    ready: false,
    x: 0,
    y: CAMERA_HEIGHT,
    z: 0,
    lookX: 0,
    lookY: LOOK_HEIGHT,
    lookZ: 0,
    kartX: 0,
    kartZ: 0,
    angle: 0,
    rank: 0,
    lap: 1,
  }));
}

function findKart(karts, number) {
  for (let index = 0; index < karts.length; index++) if (karts[index].number === number) return karts[index];
  return null;
}

export function updateFollowCameras(states, frame, previous, interpolation, options = {}) {
  const karts = frame?.karts || [];
  const previousKarts = previous?.karts || [];
  const t = Number.isFinite(interpolation) ? clamp(interpolation, 0, 1) : 1;
  const smoothing = clamp(option(options.smoothing, DEFAULT_SMOOTHING), 0, 1);
  const back = option(options.back, CAMERA_BACK, 0);
  const height = option(options.height, CAMERA_HEIGHT, 1);
  const lookAhead = option(options.lookAhead, LOOK_AHEAD, 1);
  const lookHeight = option(options.lookHeight, LOOK_HEIGHT);

  for (let index = 0; index < states.length; index++) {
    const state = states[index];
    const kart = findKart(karts, state.number);
    if (!kart) { state.visible = false; continue; }

    const before = findKart(previousKarts, state.number);
    const x = before ? lerp(before.x, kart.x, t) : kart.x;
    const y = before ? lerp(before.y, kart.y, t) : kart.y;
    const angle = before ? before.angle + wrapAngle(kart.angle - before.angle) * t : kart.angle;
    const kartX = (x - ORIGIN_X) * SCALE;
    const kartZ = (y - ORIGIN_Y) * SCALE;
    const facing = -angle;
    const cos = Math.cos(facing), sin = Math.sin(facing);
    const desiredX = kartX - cos * back;
    const desiredZ = kartZ - sin * back;
    const desiredLookX = kartX + cos * lookAhead;
    const desiredLookZ = kartZ + sin * lookAhead;

    if (!state.ready) {
      state.x = desiredX; state.y = height; state.z = desiredZ;
      state.lookX = desiredLookX; state.lookY = lookHeight; state.lookZ = desiredLookZ;
      state.ready = true;
    } else {
      state.x = lerp(state.x, desiredX, smoothing);
      state.y = lerp(state.y, height, smoothing);
      state.z = lerp(state.z, desiredZ, smoothing);
      state.lookX = lerp(state.lookX, desiredLookX, smoothing);
      state.lookY = lerp(state.lookY, lookHeight, smoothing);
      state.lookZ = lerp(state.lookZ, desiredLookZ, smoothing);
    }

    state.visible = true;
    state.kartX = kartX;
    state.kartZ = kartZ;
    state.angle = angle;
    state.rank = kart.rank;
    state.lap = kart.lap;
  }
}
