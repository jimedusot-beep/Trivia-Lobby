// Original, server-authoritative Tap Dash; inspired by Open Party Lab's Tap Race
// gameplay concept. No upstream implementation or assets are copied.
export const TAP_HEATS = 3;
export const TAP_DURATION_MS = 12000;
export const TAP_MIN_INTERVAL_MS = 75; // Per-human cap ~13 taps/s.
const fail = message => { throw new Error(message); };
const ordered = racers => [...racers].sort((a, b) => b.taps - a.taps || a.slot - b.slot);

export function openTap(p) {
  const now = p.clock();
  p.pack = {
    kind: "tap", duration: TAP_DURATION_MS, startedAt: now, scored: false, results: null,
    racers: p.roster.map((id, slot) => ({ id, slot, taps: 0, lastTapAt: -Infinity, seq: -1 })),
  };
  p.enter("playing", TAP_DURATION_MS);
}

// Authenticated socket identity is supplied by transport, never by the browser.
export function acceptTapInput(p, actor, message) {
  const fields = ["v", "type", "matchId", "heat", "seq"];
  if (!message || typeof message !== "object" || Array.isArray(message) ||
      Object.keys(message).length !== fields.length ||
      fields.some(key => !Object.hasOwn(message, key)) ||
      message.v !== 1 || message.type !== "tap_input" ||
      !Number.isSafeInteger(message.seq) || message.seq < 0 || message.seq > 2147483647 ||
      !Number.isSafeInteger(message.heat)) fail("Invalid tap controls.");
  if (p.mode !== "tap" || !["playing", "reveal"].includes(p.phase) ||
      p.matchId !== message.matchId || message.heat !== p.index ||
      (p.phase === "playing" && p.clock() >= p.deadline)) fail("This tap round has expired.");
  const racer = p.pack?.racers.find(entry => entry.id === actor);
  if (actor === "host" || !racer || !p.players.get(actor)?.connected)
    fail("Only a connected player may tap.");
  if (p.phase === "reveal") return false;
  if (message.seq <= racer.seq) return false;
  racer.seq = message.seq;
  const now = p.clock();
  if (now - racer.lastTapAt < TAP_MIN_INTERVAL_MS) return false;
  racer.lastTapAt = now;
  racer.taps++;
  p.touched = now;
  return true;
}

export function finishTap(p) {
  if (p.mode !== "tap" || p.phase !== "playing" || p.pack?.kind !== "tap" || p.pack.scored) return;
  const pack = p.pack;
  pack.scored = true; // At-most-once awards across timeout and reconnect races.
  const racers = ordered(pack.racers);
  let place = 0;
  pack.results = racers.map((racer, index) => {
    if (index === 0 || racer.taps !== racers[index - 1].taps) place = index + 1;
    const points = racer.taps === 0 ? 0 : Math.max(10, 100 - (place - 1) * 5);
    const player = p.players.get(racer.id);
    player.score += points;
    return { id: racer.id, name: player.name, taps: racer.taps, place, points };
  });
  p.enter("reveal");
}

export function nextTap(p) {
  if (++p.index >= TAP_HEATS) p.enter("finished");
  else {
    p.pack = null;
    p.enter("countdown", p.countdownMs);
  }
}

export function tapFrame(p, actor) {
  const r = p.pack;
  const ranking = ordered(r.racers);
  const own = ranking.find(entry => entry.id === actor);
  return {
    type: "tap_frame", matchId: p.matchId, heat: p.index,
    remainingMs: Math.max(0, p.deadline - p.clock()),
    ...(actor === "host" ? {
      racers: ranking.map((racer, i) => ({
        name: p.players.get(racer.id).name, taps: racer.taps,
        place: ranking.findIndex(entry => entry.taps === racer.taps) + 1,
        connected: p.players.get(racer.id).connected,
      })),
    } : {
      own: own ? { taps: own.taps, place: ranking.findIndex(entry => entry.taps === own.taps) + 1, seq: own.seq } : null,
    }),
  };
}
export function projectTap(p, actor) {
  return {
    kind: "tap", totalHeats: TAP_HEATS, durationMs: TAP_DURATION_MS,
    results: p.pack.results, ...tapFrame(p, actor),
  };
}
