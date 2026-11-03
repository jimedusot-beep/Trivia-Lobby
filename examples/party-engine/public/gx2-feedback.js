// Original, optional presentation-only feedback. No games import this module yet.
// A caller must invoke unlock() directly from a user gesture; nothing autoplays.
export const feedbackCues = Object.freeze({
  confirm: [[660, 0, .09]],
  countdown: [[440, 0, .13]],
  cardFlip: [[520, 0, .07], [680, .065, .08]],
  raceBoost: [[330, 0, .09], [495, .085, .14]],
  correct: [[587, 0, .12], [880, .12, .14]],
  incorrect: [[330, 0, .13], [220, .12, .13]],
  victory: [[523, 0, .17], [659, .14, .17], [784, .28, .17], [1047, .42, .25]]
});
export const feedbackLabels = Object.freeze({
  confirm: "Confirmed", countdown: "Get ready", cardFlip: "Card revealed",
  raceBoost: "Boost", correct: "Correct", incorrect: "Try again", victory: "Victory!"
});
const SETTINGS_KEY = "trivia-lobby-gx2-feedback-v1";
const getStorage = () => { try { return globalThis.localStorage ?? null; } catch { return null; } };
const getMotion = () => { try { return !!globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches; } catch { return false; } };
const getSaveData = () => { try { return !!globalThis.navigator?.connection?.saveData; } catch { return false; } };
const createAudio = () => {
  const Audio = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  return Audio ? new Audio() : null;
};
const clampVolume = value => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : null;

// Injectable adapters make all lifecycle behavior testable without browser or sound hardware.
export function createFeedbackToolkit({
  audioFactory = createAudio, storage = getStorage(), output = null,
  reducedMotion = getMotion, saveData = getSaveData,
  schedule = (callback, ms) => setTimeout(callback, ms),
  unschedule = timer => clearTimeout(timer), maxEventIds = 128
} = {}) {
  let muted = true, volume = .35, lowPower = false, unlocked = false;
  let context = null, disposed = false, round = "initial", visualTimer = null;
  const seen = new Set(), active = new Set();
  const limit = Number.isSafeInteger(maxEventIds) ? Math.max(8, Math.min(512, maxEventIds)) : 128;
  try {
    const saved = JSON.parse(storage?.getItem(SETTINGS_KEY) ?? "null");
    if (typeof saved?.muted === "boolean") muted = saved.muted;
    if (clampVolume(saved?.volume) !== null) volume = clampVolume(saved.volume);
    if (typeof saved?.lowPower === "boolean") lowPower = saved.lowPower;
  } catch { /* Restricted storage is optional. */ }
  const persist = () => {
    try { storage?.setItem(SETTINGS_KEY, JSON.stringify({muted, volume, lowPower})); }
    catch { /* Never prevent gameplay. */ }
  };
  const clearVisual = () => {
    if (visualTimer !== null) { unschedule(visualTimer); visualTimer = null; }
    if (output) {
      output.textContent = "";
      delete output.dataset.gx2Cue;
      delete output.dataset.gx2Motion;
    }
  };
  const cancelVoices = () => {
    for (const voice of active) {
      try { voice.osc.onended = null; voice.osc.stop(0); } catch {}
      try { voice.osc.disconnect(); voice.gain.disconnect(); } catch {}
    }
    active.clear();
  };
  const showVisual = cue => {
    if (!output) return;
    clearVisual();
    output.textContent = feedbackLabels[cue];
    output.dataset.gx2Cue = cue;
    output.dataset.gx2Motion = lowPower || saveData() || reducedMotion() ? "off" : "on";
    visualTimer = schedule(() => { visualTimer = null; clearVisual(); }, 900);
  };
  const state = () => ({muted, volume, lowPower, unlocked, round, disposed, activeVoices: active.size, rememberedIds: seen.size});
  return Object.freeze({
    state,
    async unlock() {
      if (disposed) return false;
      try {
        context ??= audioFactory();
        if (!context) return false;
        await context.resume();
        if (disposed) return false;
        unlocked = context.state === "running";
        return unlocked;
      } catch { unlocked = false; return false; }
    },
    setMuted(value) {
      if (disposed) return false;
      muted = !!value; if (muted) cancelVoices(); persist(); return muted;
    },
    setVolume(value) {
      if (disposed) return false;
      const v = clampVolume(value);
      if (v === null) return false;
      volume = v; if (v === 0) cancelVoices(); persist(); return true;
    },
    setLowPower(value) {
      if (disposed) return false;
      lowPower = !!value; if (lowPower) cancelVoices(); persist(); return lowPower;
    },
    beginRound(id) {
      if (disposed || typeof id !== "string" || !id || id.length > 128) return false;
      if (round === id) return true;
      round = id; seen.clear(); cancelVoices(); clearVisual(); return true;
    },
    play(cue, {eventId, roundId} = {}) {
      if (disposed || !Object.hasOwn(feedbackCues, cue) || (roundId !== undefined && roundId !== round))
        return {accepted: false, sounded: false};
      if (eventId !== undefined) {
        if (typeof eventId !== "string" || !eventId || eventId.length > 128 || seen.has(eventId))
          return {accepted: false, sounded: false};
        if (seen.size >= limit) seen.delete(seen.values().next().value);
        seen.add(eventId);
      }
      showVisual(cue);
      if (!unlocked || muted || volume === 0 || lowPower || saveData() || context?.state !== "running")
        return {accepted: true, sounded: false};
      let sounded = false;
      for (const [frequency, offset, duration] of feedbackCues[cue]) {
        if (active.size >= 20) break; // Bounded overlapping tones.
        let osc, gain;
        try {
          osc = context.createOscillator(); gain = context.createGain();
          const when = context.currentTime + offset;
          osc.type = cue === "incorrect" ? "triangle" : "sine";
          osc.frequency.setValueAtTime(frequency, when);
          gain.gain.setValueAtTime(.0001, when);
          gain.gain.exponentialRampToValueAtTime(Math.max(.001, volume * .11), when + .025);
          gain.gain.exponentialRampToValueAtTime(.0001, when + duration);
          osc.connect(gain); gain.connect(context.destination);
          const voice = {osc, gain};
          osc.onended = () => {
            try { osc.disconnect(); gain.disconnect(); } catch {}
            active.delete(voice);
          };
          osc.start(when); osc.stop(when + duration + .02);
          active.add(voice); sounded = true;
        } catch {
          try { osc?.disconnect(); gain?.disconnect(); } catch {}
          // Audio failure is only a presentation failure.
        }
      }
      return {accepted: true, sounded};
    },
    async dispose() {
      if (disposed) return;
      disposed = true; unlocked = false;
      cancelVoices(); clearVisual(); seen.clear();
      const old = context; context = null;
      try { await old?.close(); } catch {}
    }
  });
}
