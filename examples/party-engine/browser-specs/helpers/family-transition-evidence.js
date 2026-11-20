import { writeFile } from "node:fs/promises";

const attempts = new WeakMap();
const WIRE_LIMIT = 256, DOM_LIMIT = 128, REQUEST_LIMIT = 128, PAGE_LIMIT = 5;
const types = new Set(["ping", "pong", "play", "next", "ack", "state", "error", "join", "create", "credential", "start", "ready", "resume"]);
const phases = new Set(["lobby", "countdown", "playing", "reveal", "finished"]);
const stages = new Set(["buzz", "faceoff", "play", "steal", "board-reveal", "final-ready", "final-answer", "final-review", "final-reveal"]);
const actions = new Set(["buzz", "answer", "strike", "reveal", "final-start", "final-answer", "final-publish"]);
const statuses = new Set(["accepted", "sending", "wait", "ready", "connected"]);
const domEvents = new Set(["document", "dom", "pointerdown", "pointerup", "click", "final"]);
const integer = (value, max = 1000000) => Number.isFinite(value) ? Math.max(0, Math.min(max, Math.round(value))) : 0;
const elapsed = value => integer(value, 120000);
const note = info => info.annotations.push({ type: "family-transition-evidence-unavailable", description: "Some transition evidence could not be retained; test results are unchanged." });

// This runs only in synthetic browser fixtures. It never writes application
// storage or replaces input handlers. Node retains events across host reloads.
function observeHostDOM() {
  const ids = new WeakMap(); let identity = 0, previous, tracking = false;
  const identify = button => { if (button && !ids.has(button)) ids.set(button, ++identity); return button ? ids.get(button) : 0; };
  const snapshot = () => {
    const button = document.querySelector("#host-next-controls button"), rect = button?.getBoundingClientRect();
    const text = document.querySelector("#status")?.textContent || "";
    const status = text === "Submission accepted." ? "accepted" : text === "Sending…" ? "sending"
      : text === "Wait for the connection or current submission." ? "wait" : text === "Party ready." ? "ready" : text === "Connected." ? "connected" : "other";
    const phase = document.body?.dataset.partyPhase;
    return { phase: ["lobby", "countdown", "playing", "reveal", "finished"].includes(phase) ? phase : "other", status,
      round: Number((document.querySelector("#content")?.textContent || "").match(/Board (\d+) of \d+/)?.[1] || 0),
      nextId: identify(button), nextDisabled: button ? button.disabled : null,
      nextY: rect ? Math.round(rect.y) : 0 };
  };
  const send = item => window.__pwFamilyTransition({ epoch: Date.now(), ...item }).catch(() => {});
  const record = (event, extra = {}) => send({ event, ...snapshot(), ...extra });
  const listener = event => {
    const button = event.target.closest?.("#host-next-controls button");
    if (event.type === "pointerdown") tracking = !!button;
    if (button || tracking) void record(event.type, { target: button ? "next" : "other", targetId: identify(button), pointerId: event.pointerId, x: event.clientX, y: event.clientY });
    if (event.type === "click") tracking = false;
  };
  for (const type of ["pointerdown", "pointerup", "click"]) document.addEventListener(type, listener, true);
  const observer = new MutationObserver(() => {
    const signature = JSON.stringify(snapshot());
    if (signature !== previous) { previous = signature; void record("dom"); }
  });
  const start = () => { void record("document"); observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["disabled", "data-party-phase"] }); };
  document.addEventListener("DOMContentLoaded", start, { once: true });
  window.__pwFamilyDOM = { stop() {
    observer.disconnect(); document.removeEventListener("DOMContentLoaded", start);
    for (const type of ["pointerdown", "pointerup", "click"]) document.removeEventListener(type, listener, true);
    delete window.__pwFamilyDOM;
    return { epoch: Date.now(), ...snapshot() };
  } };
}

export function createFamilyTransitionEvidence(info) {
  if (attempts.has(info)) return attempts.get(info).api;
  const pages = []; let stopPromise;
  const state = { pages, api: { observe, stop } }; attempts.set(info, state);
  async function observe(page, role) {
    if (pages.length >= PAGE_LIMIT || stopPromise) return;
    const entry = { role: /^(host|guest-[1-4])$/.test(role) ? role : "other", wire: [], dom: [], documents: 0,
      dropped: { wire: 0, dom: 0 }, captureUnavailable: false };
    const started = Date.now(), listeners = [], requests = new Map(); let stopped = false, domInstalled = false;
    pages.push(entry);
    const wire = item => { if (stopped) return; if (entry.wire.length < WIRE_LIMIT) entry.wire.push({ ms: elapsed(Date.now() - started), ...item }); else entry.dropped.wire++; };
    const dom = item => {
      if (stopped) return;
      if (item?.event === "document") entry.documents++;
      if (entry.dom.length >= DOM_LIMIT) { entry.dropped.dom++; return; }
      const safe = { ms: elapsed(Number.isFinite(item?.epoch) ? item.epoch - started : 0), event: domEvents.has(item?.event) ? item.event : "other", document: entry.documents,
        phase: phases.has(item?.phase) ? item.phase : "other", status: statuses.has(item?.status) ? item.status : "other",
        round: integer(item?.round, 10), nextId: integer(item?.nextId), nextDisabled: typeof item?.nextDisabled === "boolean" ? item.nextDisabled : null };
      if (item?.target !== undefined) safe.target = item.target === "next" ? "next" : "other";
      for (const key of ["targetId", "pointerId", "nextY", "x", "y"]) if (Number.isFinite(item?.[key])) safe[key] = Math.max(-100000, Math.min(100000, Math.round(item[key])));
      entry.dom.push(safe);
    };
    const listen = (target, event, fn) => { target.on(event, fn); listeners.push([target, event, fn]); };
    listen(page, "pageerror", () => wire({ event: "pageerror" }));
    listen(page, "websocket", socket => {
      for (const [event, direction] of [["framesent", "sent"], ["framereceived", "received"]]) listen(socket, event, frame => {
        let message;
        try { if (Buffer.byteLength(frame.payload) <= 65536) message = JSON.parse(frame.payload); } catch { /* Never retain raw frames. */ }
        const item = { event: direction, type: types.has(message?.type) ? message.type : "other" };
        if (typeof message?.requestId === "string" && message.requestId.length <= 128) {
          if (!requests.has(message.requestId) && requests.size < REQUEST_LIMIT) requests.set(message.requestId, requests.size + 1);
          item.request = requests.get(message.requestId) || 0;
        }
        if (message?.type === "next") item.revision = integer(message.revision);
        if (message?.type === "play") item.action = actions.has(message.value?.action) ? message.value.action : "other";
        if (message?.type === "error") item.category = typeof message.message === "string" && /out of date/.test(message.message) ? "stale" : "other";
        if (message?.type === "state") {
          item.phase = phases.has(message.state?.phase) ? message.state.phase : "other";
          item.stage = stages.has(message.state?.pack?.stage) ? message.state.pack.stage : "other";
          item.round = integer(message.state?.pack?.round, 10); item.index = integer(message.state?.index); item.revision = integer(message.state?.revision);
        }
        wire(item);
      });
    });
    if (entry.role === "host") try {
      await page.exposeBinding("__pwFamilyTransition", (_, item) => dom(item));
      await page.addInitScript(observeHostDOM); domInstalled = true;
    } catch { entry.captureUnavailable = true; note(info); }
    entry.stop = async () => {
      for (const [target, event, fn] of listeners) target.off(event, fn);
      if (domInstalled) {
        let timer;
        const final = await Promise.race([
          page.evaluate(() => window.__pwFamilyDOM?.stop()).catch(() => undefined),
          new Promise(resolve => { timer = setTimeout(resolve, 1000); }),
        ]).finally(() => clearTimeout(timer));
        if (final) dom({ ...final, event: "final" }); else entry.captureUnavailable = true;
      }
      stopped = true; delete entry.stop;
    };
  }
  function stop() {
    return stopPromise ||= Promise.all(pages.map(async entry => {
      try { await entry.stop?.(); } catch { entry.captureUnavailable = true; }
    }));
  }
  return state.api;
}

export async function finishFamilyTransitionEvidence(info) {
  const state = attempts.get(info); if (!state) return;
  attempts.delete(info); await state.api.stop();
  if (!["failed", "timedOut"].includes(info.status)) return;
  try {
    const output = { schemaVersion: 1, retry: integer(info.retry, 100), limits: { pages: PAGE_LIMIT, wirePerPage: WIRE_LIMIT, domPerPage: DOM_LIMIT }, pages: state.pages };
    const file = info.outputPath("family-transition-diagnostics.json");
    await writeFile(file, JSON.stringify(output, null, 2) + "\n");
    await info.attach("family-transition-diagnostics", { path: file, contentType: "application/json" });
  } catch { note(info); }
}
