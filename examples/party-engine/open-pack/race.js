// SPDX-License-Identifier: AGPL-3.0-or-later
import { randomInt } from "node:crypto";
import { clamp, damp, wrapAngle, trackDelta, DRIFT_THRESHOLDS, DRIFT_BOOST_SECONDS } from "../public/race-math.js";
import { TRACK, trackPose, nearestTrack, ITEM_SPOTS, BOOST_SPOTS } from "../public/race-track.js";

export const RACE_STEP_MS = 50;
export const RACE_HEATS = 3;
const RADIUS = 9;
const fail = message => { throw new Error(message); };
const rounded = n => Math.round(n * 10) / 10;

export function openRace(p) {
  const now = p.clock();
  // Reverse the previous heat's order so the championship leader starts behind.
  const grid = p.index ? [...p.roster].sort((a, b) => p.players.get(a).score - p.players.get(b).score || p.roster.indexOf(a) - p.roster.indexOf(b)) : p.roster;
  p.pack = { kind: "race", startedAt: now, stepAt: now, frame: 0, scored: false,
    duration: p.raceMs ?? 60000, laps: p.raceLaps ?? 3, hazards: [], finishes: [],
    boxes: ITEM_SPOTS.map(t => ({ t, readyAt: 0 })), results: null,
    karts: grid.map((id, slot) => {
      const t = -(Math.floor(slot / 4) + 1) * 0.012;
      const pose = trackPose(t), lane = ((slot % 4) - 1.5) * 21;
      return { id, number: p.roster.indexOf(id) + 1,
        x: pose.x - Math.sin(pose.angle) * lane, y: pose.y + Math.cos(pose.angle) * lane,
        angle: pose.angle, speed: 0, t: ((t % 1) + 1) % 1, progress: t,
        // Credit laps only after each forward checkpoint was physically traversed.
        checkpoint: 0, lap: 1, finishAt: null, rank: slot + 1,
        input: { steer: 0, drift: false, item: false, assist: true }, inputAt: now,
        seq: -1, boost: 0, shield: 0, slow: 0, charge: 0, stage: 0,
        drift: false, item: null, pendingItem: false, padAt: 0, assisting: true };
    }) };
  p.enter("playing", p.pack.duration);
}

/** Fast inputs deliberately do not share the revision-based turn/action envelope. */
export function acceptRaceInput(p, actor, m) {
  const fields = ["v", "type", "matchId", "heat", "seq", "steer", "drift", "item", "assist"];
  if (!m || typeof m !== "object" || Array.isArray(m) ||
      Object.keys(m).length !== fields.length || fields.some(k => !Object.hasOwn(m, k)) ||
      m.type !== "race_input" || m.v !== 1 || !Number.isSafeInteger(m.seq) || m.seq < 0 || m.seq > 2147483647 ||
      typeof m.steer !== "number" || !Number.isFinite(m.steer) || Math.abs(m.steer) > 1 ||
      [m.drift, m.item, m.assist].some(x => typeof x !== "boolean")) fail("Invalid racing controls.");
  if (p.mode !== "race" || !["playing", "reveal"].includes(p.phase) || m.matchId !== p.matchId || m.heat !== p.index)
    fail("These controls belong to an old race.");
  const k = p.pack.karts.find(k => k.id === actor);
  if (!k || actor === "host" || !p.players.get(actor)?.connected) fail("Only a connected racer can drive their kart.");
  // A valid input already in flight when results publish cannot affect the heat.
  if (p.phase === "reveal") return false;
  if (m.seq <= k.seq) return false;
  k.seq = m.seq;
  // Preserve a quick tap that begins and ends between two 50 ms physics ticks.
  if (m.item && !k.input.item) k.pendingItem = true;
  k.input = { steer: m.steer, drift: m.drift, item: m.item, assist: m.assist };
  k.inputAt = p.clock();
  p.touched = p.clock();
  return true;
}

export function raceReconnected(p, actor) {
  if (p.mode !== "race" || !p.pack?.karts) return;
  const k = p.pack.karts.find(k => k.id === actor);
  if (k) { k.seq = -1; k.inputAt = -Infinity; k.input.item = false; k.input.drift = false; k.pendingItem = false; }
}

function useItem(r, k, now) {
  const item = k.item;
  if (!item) return;
  k.item = null;
  if (item === "dash") k.boost = Math.max(k.boost, 1.8);
  if (item === "shield") k.shield = 5;
  if (item === "paint") {
    r.hazards.push({ x: k.x - Math.cos(k.angle) * 26, y: k.y - Math.sin(k.angle) * 26, owner: k.id, expires: now + 5500 });
    if (r.hazards.length > 24) r.hazards.shift();
  }
  if (item === "spark") {
    const target = r.karts.filter(other => other.id !== k.id && !other.finishAt && other.progress > k.progress)
      .sort((a, b) => a.progress - b.progress)[0];
    if (target) {
      if (target.shield > 0) target.shield = 0;
      else { target.slow = 0.85; target.speed *= 0.45; }
    } else k.boost = Math.max(k.boost, 0.9);
  }
}

function step(p, now) {
  const r = p.pack, dt = RACE_STEP_MS / 1000;
  r.hazards = r.hazards.filter(h => h.expires > now);
  for (const k of r.karts) {
    if (k.finishAt !== null) continue;
    const stale = !p.players.get(k.id)?.connected || now - k.inputAt > 1000;
    k.assisting = stale || k.input.assist;
    const pose = nearestTrack(k.x, k.y);
    const target = trackPose(pose.t + 0.032);
    const automatic = clamp(wrapAngle(Math.atan2(target.y - k.y, target.x - k.x) - k.angle) * 2.5, -1, 1);
    const steer = stale ? automatic : k.input.assist ? clamp(automatic + k.input.steer * 0.8, -1, 1) : k.input.steer;
    const drifting = !stale && k.input.drift && (k.drift || Math.abs(steer) > 0.12) && k.speed > 50 && !k.slow;
    k.boost = Math.max(0, k.boost - dt);
    k.shield = Math.max(0, k.shield - dt);
    k.slow = Math.max(0, k.slow - dt);
    if (drifting) {
      k.charge = Math.min(4, k.charge + dt);
      k.stage = DRIFT_THRESHOLDS.filter(t => k.charge >= t).length;
    } else {
      if (k.drift && !stale) k.boost = Math.max(k.boost, DRIFT_BOOST_SECONDS[k.stage]);
      k.charge = 0; k.stage = 0;
    }
    k.drift = drifting;
    if (!stale && k.pendingItem) useItem(r, k, now);
    k.pendingItem = false;
    const top = (k.boost ? 230 : 165) * (k.slow ? 0.45 : 1) * (drifting ? 0.965 : 1);
    k.speed = damp(k.speed, top, k.boost ? 7 : 2.2, dt);
    k.angle = wrapAngle(k.angle + steer * (drifting ? 2.0 : 1.7) * clamp(k.speed / 120, 0.35, 1.2) * dt);
    const heading = k.angle - (drifting ? steer * 0.22 : 0);
    k.x += Math.cos(heading) * k.speed * dt;
    k.y += Math.sin(heading) * k.speed * dt;
    let next = nearestTrack(k.x, k.y);
    const limit = TRACK.halfRoad - RADIUS;
    if (next.distance > limit) {
      const scale = limit / next.distance;
      k.x = next.x + (k.x - next.x) * scale;
      k.y = next.y + (k.y - next.y) * scale;
      k.speed *= 0.85;
      k.angle = wrapAngle(k.angle + wrapAngle(next.angle - k.angle) * 0.2);
      next = nearestTrack(k.x, k.y);
    }
    const delta = trackDelta(k.t, next.t);
    if (Math.abs(delta) < 0.04) k.progress += delta;
    k.t = next.t;
    // A checkpoint can only be earned once, by forward physical travel. No
    // client-reported position/lap or backwards start-line farming is accepted.
    while (k.progress >= (k.checkpoint + 1) / 4) k.checkpoint++;
    k.lap = Math.min(r.laps, Math.floor(Math.max(0, k.checkpoint) / 4) + 1);
    if (k.checkpoint >= r.laps * 4) {
      k.finishAt = now;
      r.finishes.push(k.id);
      k.speed = 0;
      p.deadline = Math.min(p.deadline, now + 15000);
    }
    for (const box of r.boxes) {
      const at = trackPose(box.t);
      if (!k.item && box.readyAt <= now && Math.hypot(k.x - at.x, k.y - at.y) < 32) {
        const pool = k.rank > r.karts.length / 2 ? ["dash", "dash", "shield", "spark"] : ["dash", "shield", "paint", "spark"];
        k.item = pool[randomInt(pool.length)]; box.readyAt = now + 900;
      }
    }
    if (now >= k.padAt && BOOST_SPOTS.some(t => Math.abs(trackDelta(t, k.t)) < 0.009)) {
      k.boost = Math.max(k.boost, 0.8); k.padAt = now + 2000;
    }
    for (const h of r.hazards) if (h.owner !== k.id && Math.hypot(k.x - h.x, k.y - h.y) < 23) {
      if (k.shield > 0) k.shield = 0;
      else k.slow = 0.6;
      h.expires = 0;
    }
  }
  // Bounded pair resolution; starting-grid grace avoids a 20-kart pile-up.
  if (now - r.startedAt > 1800) for (let i = 0; i < r.karts.length; i++) for (let j = i + 1; j < r.karts.length; j++) {
    const a = r.karts[i], b = r.karts[j];
    if (a.finishAt !== null || b.finishAt !== null) continue;
    const dx = a.x - b.x, dy = a.y - b.y, d = Math.hypot(dx, dy);
    if (d < RADIUS * 2 && d > 0.01) {
      const push = (RADIUS * 2 - d) * 0.5;
      a.x += dx / d * push; a.y += dy / d * push;
      b.x -= dx / d * push; b.y -= dy / d * push;
    }
  }
  orderRace(r).forEach((k, i) => { k.rank = i + 1; });
  r.frame++;
}

export function orderRace(r) {
  return [...r.karts].sort((a, b) =>
    (a.finishAt ?? Infinity) - (b.finishAt ?? Infinity) || b.progress - a.progress || a.number - b.number);
}
export function finishRace(p) {
  const r = p.pack;
  if (!r || r.kind !== "race" || r.scored || p.phase !== "playing") return;
  r.scored = true;
  r.results = orderRace(r).map((k, i) => {
    const points = Math.max(5, 100 - i * 5);
    p.players.get(k.id).score += points;
    return { id: k.id, number: k.number, name: p.players.get(k.id).name, place: i + 1,
      points, finished: k.finishAt !== null, seconds: k.finishAt === null ? null : rounded((k.finishAt - r.startedAt) / 1000) };
  });
  p.enter("reveal");
}
export function advanceRace(p) {
  if (p.mode !== "race" || p.phase !== "playing" || p.pack?.kind !== "race") return false;
  const now = p.clock(), r = p.pack;
  // Discard excessive wall-time debt after a paused process; never teleport a
  // kart through a long unobserved simulation, and keep absolute heat deadlines.
  if (now - r.stepAt > 300) r.stepAt = now - 250;
  while (now - r.stepAt >= RACE_STEP_MS) {
    r.stepAt += RACE_STEP_MS;
    step(p, r.stepAt);
  }
  if (now >= p.deadline || r.karts.every(k => k.finishAt !== null)) finishRace(p);
  return true;
}
export function nextRace(p) {
  if (++p.index >= RACE_HEATS) p.enter("finished");
  else { p.pack = null; p.enter("countdown", p.countdownMs); }
}
function ownView(k) {
  return k ? { number: k.number, rank: k.rank, lap: k.lap, speed: Math.round(k.speed),
    item: k.item, charge: rounded(k.charge), stage: k.stage, boost: rounded(k.boost),
    shield: rounded(k.shield), finished: k.finishAt !== null, assisting: k.assisting,
    assist: k.input.assist, seq: k.seq } : null;
}
export function raceFrame(p, actor) {
  const r = p.pack;
  return { type: "race_frame", matchId: p.matchId, heat: p.index, frame: r.frame,
    remaining: Math.max(0, Math.ceil((p.deadline - p.clock()) / 1000)),
    ...(actor === "host" ? {
      karts: r.karts.map(k => ({ number: k.number, x: rounded(k.x), y: rounded(k.y),
        angle: rounded(k.angle * 100) / 100, rank: k.rank, lap: k.lap, drift: k.stage,
        boost: k.boost > 0, shield: k.shield > 0, finished: k.finishAt !== null,
        helping: !p.players.get(k.id).connected || p.clock() - k.inputAt > 1000 })),
      boxes: r.boxes.map(b => b.readyAt <= p.clock()),
      hazards: r.hazards.filter(h => h.expires > p.clock()).map(h => ({ x: rounded(h.x), y: rounded(h.y) })),
    } : { own: ownView(r.karts.find(k => k.id === actor)) }) };
}
export function projectRace(p, actor) {
  const r = p.pack;
  return { kind: "race", totalHeats: RACE_HEATS, laps: r.laps,
    title: "Sunset Speedway", roster: r.karts.map(k => ({ id: k.id, number: k.number, name: p.players.get(k.id).name })),
    ...raceFrame(p, actor), results: r.results };
}
