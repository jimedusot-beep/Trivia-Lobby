import { writeFile } from "node:fs/promises";

const attempts = new WeakMap();
const LIMIT = { pages: 5, sockets: 16, wire: 256, dom: 128, requests: 128 };
const scopes = new Set(["family-join", "doodle-next", "wave-gas"]);
const types = new Set(["ping", "pong", "join", "create", "resume", "credential", "ready", "state", "error", "start", "next", "play", "ack"]);
const phases = new Set(["lobby", "countdown", "question", "playing", "racing", "reveal", "finished"]);
const stages = new Set(["buzz", "faceoff", "play", "steal", "board-reveal", "final-ready", "final-answer", "final-review", "final-reveal", "choose", "draw"]);
const actions = new Set(["drive", "buzz", "answer", "strike", "reveal", "final-start", "final-answer", "final-publish", "choose", "guess"]);
const events = new Set(["document", "dom", "pointerdown", "pointerup", "pointercancel", "click", "submit", "keydown", "keyup", "final"]);
const targets = new Set(["join", "host-next", "gas"]);
const statuses = new Set(["connecting", "connected", "joining", "ready", "accepted", "sending", "wait", "reconnecting"]);
const integer = (value, max = 1000000) => Number.isFinite(value) ? Math.max(0, Math.min(max, Math.round(value))) : 0;
const note = info => { try { info.annotations.push({ type: "interaction-evidence-unavailable", description: "Some diagnostic evidence is unavailable; the original test result is unchanged." }); } catch {} };

// Runs only in synthetic browser tests, before navigation. It does not replace
// input/WebSocket handlers or touch application storage. Only closed vocabulary
// and primitive state leave the page; authored text/URLs are never copied.
function observeDOM() {
  const ids = new WeakMap(), pending = new Set(), heldKeys = new Set(), keyReleases = new WeakSet();
  let sequence = 0, previous, tracking = false, stopped = false, browserDropped = 0;
  const identify = node => { if (node && !ids.has(node)) ids.set(node, ++sequence); return node ? ids.get(node) : 0; };
  const gasButton = () => [...document.querySelectorAll(".arcade-race-controls button")].find(b => /^GAS: (ON|OFF)/.test(b.textContent));
  const snapshot = () => {
    const next = document.querySelector("#host-next-controls button"), gas = gasButton();
    const text = document.querySelector("#status")?.textContent || "";
    const status = text === "Submission accepted." ? "accepted" : text === "Sending…" ? "sending"
      : text === "Wait for the connection or current submission." ? "wait" : /^(Party ready\.|Reconnected\.)$/.test(text) ? "ready"
      : text === "Connected." ? "connected" : text === "Connecting…" ? "connecting" : text === "Joining your party…" ? "joining"
      : text === "Disconnected. Reconnecting…" ? "reconnecting" : "other";
    const phase = document.body?.dataset.partyPhase;
    const choosers = [...document.querySelectorAll("h2,h3")].filter(h => h.textContent === "Choose your secret word");
    return { phase: ["lobby", "countdown", "question", "playing", "racing", "reveal", "finished"].includes(phase) ? phase : "other", status,
      controllerActive: !!document.body?.classList.contains("phone-controller-active"), joinErrorVisible: !!document.querySelector("#join-error:not([hidden])"),
      nextNode: identify(next), nextDisabled: next ? next.disabled : null, gasNode: identify(gas), gas: gas ? /^GAS: ON/.test(gas.textContent) : null,
      wordChooserPresent: choosers.length > 0, wordChooserVisible: choosers.some(h => h.getClientRects().length > 0) };
  };
  const send = item => {
    if (stopped) return;
    if (pending.size >= 32) { browserDropped++; return; }
    try {
      const promise = Promise.resolve(window.__pwInteractionEvidence({ epoch: Date.now(), browserDropped, ...item })).catch(() => { browserDropped++; });
      pending.add(promise); void promise.finally(() => pending.delete(promise));
    } catch { browserDropped++; }
  };
  const record = (event, extra = {}) => send({ event, ...snapshot(), ...extra });
  const target = node => {
    const next = node.closest?.("#host-next-controls button"); if (next) return ["host-next", next];
    const gas = node.closest?.(".arcade-race-controls button"); if (gas && /^GAS: (ON|OFF)/.test(gas.textContent)) return ["gas", gas];
    const join = node.closest?.("#join button,form#join"); if (join) return ["join", join];
    return ["other", null];
  };
  const listener = stage => event => {
    const [kind, node] = target(event.target);
    const keyboard = event.type === "keydown" || event.type === "keyup";
    if (keyboard) {
      if (!["Enter", " "].includes(event.key)) return;
      // Space in a text field is typing, not native button activation. Keep a
      // known activation through target loss so its release is still visible.
      const control = kind !== "other" && (event.key === "Enter" || !!event.target.closest?.("button"));
      if (!control && !heldKeys.has(event.key) && !keyReleases.has(event)) return;
      if (stage === "capture" && event.type === "keydown" && control) heldKeys.add(event.key);
      if (stage === "capture" && event.type === "keyup" && heldKeys.delete(event.key)) keyReleases.add(event);
    }
    if (event.type === "pointerdown" && stage === "capture") tracking = kind !== "other";
    if (kind !== "other" || tracking || (keyboard && (heldKeys.has(event.key) || keyReleases.has(event)))) record(event.type, { stage, target: kind, targetNode: identify(node), trusted: event.isTrusted,
      prevented: event.defaultPrevented, ...(event.type.startsWith("key") ? { key: event.key === "Enter" ? "enter" : "space" } : {}) });
    if (["click", "pointercancel"].includes(event.type) && stage === "bubble") tracking = false;
  };
  const capture = listener("capture"), bubble = listener("bubble");
  const clearKeys = () => heldKeys.clear();
  window.addEventListener("blur", clearKeys);
  const observedEvents = ["pointerdown", "pointerup", "pointercancel", "click", "submit", "keydown", "keyup"];
  for (const type of observedEvents) { document.addEventListener(type, capture, true); document.addEventListener(type, bubble); }
  const observer = new MutationObserver(() => {
    const signature = JSON.stringify(snapshot());
    if (signature !== previous) { previous = signature; record("dom"); }
  });
  const start = () => {
    record("document"); observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["disabled", "class", "hidden", "data-party-phase"] });
  };
  document.addEventListener("DOMContentLoaded", start, { once: true });
  window.__pwInteractionDOM = { async stop() {
    stopped = true; observer.disconnect(); document.removeEventListener("DOMContentLoaded", start);
    window.removeEventListener("blur", clearKeys); heldKeys.clear();
    for (const type of observedEvents) { document.removeEventListener(type, capture, true); document.removeEventListener(type, bubble); }
    await Promise.allSettled([...pending]);
    delete window.__pwInteractionDOM;
    return { epoch: Date.now(), ...snapshot(), browserDropped };
  } };
}

export function createInteractionEvidence(info, scope) {
  if (attempts.has(info)) return attempts.get(info).api;
  const state = { scope: scopes.has(scope) ? scope : "other", pages: [], droppedPages: 0 };
  const started = Date.now(); // One origin lets host/guest timelines be compared.
  let stopPromise;
  const api = { observe, stop }; state.api = api; attempts.set(info, state);
  async function observe(page, role) {
    if (stopPromise || state.pages.length >= LIMIT.pages) { state.droppedPages = integer(state.droppedPages + 1); return; }
    const entry = { role: /^(host|guest-[1-4])$/.test(role) ? role : "other", wire: [], dom: [], documents: 0,
      dropped: { wire: 0, dom: 0, sockets: 0, requestIds: 0, browser: 0 }, captureUnavailable: false };
    state.pages.push(entry);
    const listeners = [], requests = new Map(); let stopped = false, sockets = 0, domInstalled = false, documentBrowserLoss = 0;
    const push = (key, record) => {
      if (stopped) return;
      if (entry[key].length === LIMIT[key]) { entry[key].shift(); entry.dropped[key] = integer(entry.dropped[key] + 1); }
      entry[key].push(record);
    };
    const wire = item => push("wire", { ms: integer(Date.now() - started, 120000), ...item });
    const dom = item => {
      if (stopped) return;
      if (item?.event === "document") { entry.documents = integer(entry.documents + 1); documentBrowserLoss = 0; }
      const safe = { ms: integer(Number.isFinite(item?.epoch) ? item.epoch - started : 0, 120000), event: events.has(item?.event) ? item.event : "other", document: entry.documents,
        phase: phases.has(item?.phase) ? item.phase : "other", status: statuses.has(item?.status) ? item.status : "other" };
      if (item?.stage !== undefined) safe.stage = ["capture", "bubble"].includes(item.stage) ? item.stage : "other";
      if (item?.target !== undefined) safe.target = targets.has(item.target) ? item.target : "other";
      if (item?.key !== undefined) safe.key = ["enter", "space"].includes(item.key) ? item.key : "other";
      for (const key of ["targetNode", "nextNode", "gasNode"]) if (item?.[key] !== undefined) safe[key] = integer(item[key]);
      for (const key of ["trusted", "prevented", "controllerActive", "joinErrorVisible", "nextDisabled", "gas", "wordChooserPresent", "wordChooserVisible"]) if (typeof item?.[key] === "boolean") safe[key] = item[key];
      const loss = integer(item?.browserDropped);
      if (loss > documentBrowserLoss) {
        entry.dropped.browser = integer(entry.dropped.browser + loss - documentBrowserLoss);
        documentBrowserLoss = loss;
      }
      push("dom", safe);
    };
    const listen = (target, event, fn) => {
      const guarded = (...args) => { try { fn(...args); } catch { entry.captureUnavailable = true; } };
      target.on(event, guarded); listeners.push([target, event, guarded]);
    };
    listen(page, "pageerror", () => wire({ event: "pageerror" }));
    listen(page, "websocket", socket => {
      if (sockets >= LIMIT.sockets) { entry.dropped.sockets = integer(entry.dropped.sockets + 1); return; }
      const connection = ++sockets; wire({ event: "socket", connection });
      for (const [event, direction] of [["framesent", "sent"], ["framereceived", "received"]]) listen(socket, event, frame => {
        let message;
        try { if (Buffer.byteLength(frame.payload) <= 65536) message = JSON.parse(frame.payload); } catch { /* Never retain payload bytes or parse errors. */ }
        const item = { event: direction, connection, type: types.has(message?.type) ? message.type : "other" };
        if (typeof message?.requestId === "string" && message.requestId.length <= 128) {
          if (!requests.has(message.requestId) && requests.size < LIMIT.requests) requests.set(message.requestId, requests.size + 1);
          item.request = requests.get(message.requestId) || 0;
          if (!item.request) entry.dropped.requestIds = integer(entry.dropped.requestIds + 1);
        }
        if (["next", "play", "start"].includes(message?.type)) item.revision = integer(message.revision);
        if (message?.type === "play") {
          item.action = actions.has(message.value?.action) ? message.value.action : "other";
          if (typeof message.value?.gas === "boolean") item.gas = message.value.gas;
        }
        if (message?.type === "error") item.category = typeof message.message === "string" && /out of date/.test(message.message) ? "stale" : "other";
        if (message?.type === "state") {
          item.phase = phases.has(message.state?.phase) ? message.state.phase : "other";
          item.stage = stages.has(message.state?.pack?.stage) ? message.state.pack.stage : "other";
          item.revision = integer(message.state?.revision); item.index = integer(message.state?.index);
          if (message.state?.pack) item.wordChoicesAvailable = Array.isArray(message.state.pack.choices) && message.state.pack.choices.length > 0;
          if (typeof message.state?.race?.me?.gas === "boolean") item.gas = message.state.race.me.gas;
        }
        wire(item);
      });
      listen(socket, "close", () => wire({ event: "socket-close", connection }));
    });
    try {
      await page.exposeBinding("__pwInteractionEvidence", (source, item) => { if (source.page === page && source.frame === page.mainFrame()) dom(item); });
      await page.addInitScript(observeDOM); domInstalled = true;
    } catch { entry.captureUnavailable = true; note(info); }
    entry.stop = async () => {
      for (const [target, event, fn] of listeners) target.off(event, fn);
      if (domInstalled) {
        let timer;
        const final = await Promise.race([
          page.evaluate(() => window.__pwInteractionDOM?.stop()).catch(() => undefined),
          new Promise(resolve => { timer = setTimeout(resolve, 1000); }),
        ]).finally(() => clearTimeout(timer));
        if (final) dom({ ...final, event: "final" }); else entry.captureUnavailable = true;
      }
      stopped = true; delete entry.stop;
    };
  }
  function stop() {
    return stopPromise ||= Promise.all(state.pages.map(async entry => { try { await entry.stop?.(); } catch { entry.captureUnavailable = true; } }));
  }
  return api;
}

export async function finishInteractionEvidence(info) {
  const state = attempts.get(info); if (!state) return;
  attempts.delete(info); await state.api.stop();
  if (!["failed", "timedOut"].includes(info.status)) return;
  try {
    const output = { schemaVersion: 2, timeBasis: "attempt-relative", scope: state.scope, retry: integer(info.retry, 100), limits: LIMIT, droppedPages: state.droppedPages, pages: state.pages };
    const text = JSON.stringify(output) + "\n";
    if (Buffer.byteLength(text) > 524288) throw new Error("Diagnostic size bound");
    const file = info.outputPath("interaction-diagnostics.json");
    await writeFile(file, text); await info.attach("interaction-diagnostics", { path: file, contentType: "application/json" });
  } catch { note(info); }
}
