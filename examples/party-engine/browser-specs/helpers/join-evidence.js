import { writeFile } from "node:fs/promises";

const LIMIT = 64;
const TYPES = new Set(["ping", "pong", "join", "create", "resume", "credential", "ready", "state", "error"]);
const PHASES = new Set(["lobby", "countdown", "question", "reveal", "finished", "playing"]);
const EVENTS = new Set(["socket", "sent", "received", "socket-close", "pageerror", "pointerdown", "pointerup", "click", "submit", "state-dom"]);
const STATUSES = new Set(["connecting", "connected", "joining", "ready", "reconnecting", "other"]);
const ms = value => Number.isFinite(value) ? Math.min(60000, Math.max(0, Math.round(value))) : 0;

// Only these primitives can reach the JSON. Never copy frames, exception text,
// URLs, room codes, nicknames, credentials or arbitrary DOM text into evidence.
function safeRecord(record) {
  const safe = { ms: ms(record?.ms), event: EVENTS.has(record?.event) ? record.event : "other" };
  if (record?.type !== undefined) safe.type = TYPES.has(record.type) ? record.type : "other";
  if (record?.phase !== undefined) safe.phase = PHASES.has(record.phase) ? record.phase : "other";
  if (record?.status !== undefined) safe.status = STATUSES.has(record.status) ? record.status : "other";
  if (typeof record?.controllerActive === "boolean") safe.controllerActive = record.controllerActive;
  if (typeof record?.joinErrorVisible === "boolean") safe.joinErrorVisible = record.joinErrorVisible;
  return safe;
}

function observeDOM() {
  const events = [];
  const started = performance.now();
  let dropped = 0, previous;
  const snapshot = () => {
    const text = document.querySelector("#status")?.textContent || "";
    const status = text === "Connected." ? "connected" : text === "Joining your party…" ? "joining"
      : /^(Party ready\.|Reconnected\.)$/.test(text) ? "ready"
      : text === "Disconnected. Reconnecting…" ? "reconnecting" : text === "Connecting…" ? "connecting" : "other";
    const phase = (document.querySelector("#heading")?.textContent || "").split(" · ").pop();
    return { status, phase: ["lobby", "countdown", "question", "reveal", "finished", "playing"].includes(phase) ? phase : "other",
      controllerActive: !!document.body?.classList.contains("phone-controller-active"),
      joinErrorVisible: !!document.querySelector("#join-error:not([hidden])") };
  };
  const record = event => {
    if (events.length >= 64) { dropped++; return; }
    events.push({ ms: performance.now() - started, event, ...snapshot() });
  };
  const listener = event => { if (event.target.closest?.("#join,#create")) record(event.type); };
  const types = ["pointerdown", "pointerup", "click", "submit"];
  for (const type of types) document.addEventListener(type, listener, true);
  const observer = new MutationObserver(() => {
    const signature = JSON.stringify(snapshot());
    if (signature !== previous) { previous = signature; record("state-dom"); }
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["class", "hidden"] });
  window.__pwJoinEvidence = { stop() {
    observer.disconnect();
    for (const type of types) document.removeEventListener(type, listener, true);
    const result = { events, dropped, snapshot: snapshot() };
    delete window.__pwJoinEvidence;
    return result;
  } };
}

export async function withJoinEvidence(page, testInfo, url, join) {
  const events = [], listeners = [], started = Date.now();
  let dropped = 0;
  const record = entry => {
    if (events.length >= LIMIT) { dropped++; return; }
    events.push(safeRecord({ ms: Date.now() - started, ...entry }));
  };
  const listen = (target, event, listener) => { target.on(event, listener); listeners.push([target, event, listener]); };
  listen(page, "pageerror", () => record({ event: "pageerror" }));
  listen(page, "websocket", socket => {
    record({ event: "socket" });
    for (const [event, direction] of [["framesent", "sent"], ["framereceived", "received"]]) listen(socket, event, frame => {
      let message;
      try { if (frame.payload.length <= 65536) message = JSON.parse(frame.payload); } catch { /* Record only the event, never the payload. */ }
      record({ event: direction, type: message?.type ?? "other", ...(message?.state ? { phase: message.state.phase } : {}) });
    });
    listen(socket, "close", () => record({ event: "socket-close" }));
  });
  let stopped;
  const stop = async () => {
    if (stopped) return stopped;
    for (const [target, event, listener] of listeners) target.off(event, listener);
    let timer;
    const dom = await Promise.race([
      page.evaluate(() => window.__pwJoinEvidence?.stop()).catch(() => undefined),
      new Promise(resolve => { timer = setTimeout(resolve, 1000); }),
    ]).finally(() => clearTimeout(timer));
    stopped = { events: Array.isArray(dom?.events) ? dom.events.slice(0, LIMIT).map(safeRecord) : [],
      dropped: ms(dom?.dropped), snapshot: safeRecord({ ...dom?.snapshot, event: "state-dom" }) };
    return stopped;
  };
  try {
    await page.goto(url);
    await page.evaluate(observeDOM);
    return await join();
  } catch (error) {
    try {
      const dom = await stop();
      const evidence = { schemaVersion: 1, retry: ms(testInfo.retry), events, dropped, dom };
      const path = testInfo.outputPath("join-diagnostics.json");
      await writeFile(path, JSON.stringify(evidence, null, 2) + "\n");
      await testInfo.attach("join-diagnostics", { path, contentType: "application/json" });
    } catch {
      testInfo.annotations.push({ type: "join-diagnostics-unavailable", description: "Could not preserve join evidence; the original failure is retained." });
    }
    throw error;
  } finally {
    await stop();
  }
}
