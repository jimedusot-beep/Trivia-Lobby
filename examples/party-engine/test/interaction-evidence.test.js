import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createInteractionEvidence, finishInteractionEvidence } from "../browser-specs/helpers/interaction-evidence.js";

const SECRET = "SYNTHETIC-SECRET-NOT-FOR-EVIDENCE";
class Page extends EventEmitter {
  socket = new EventEmitter();
  bindings = new Map();
  frame = {};
  mainFrame() { return this.frame; }
  async exposeBinding(name, fn) { this.bindings.set(name, fn); }
  async addInitScript() {}
  async evaluate() { return { epoch: Date.now(), phase: "reveal", status: "accepted", nextNode: 2, nextDisabled: false, browserDropped: 0 }; }
  dom(item, frame = this.frame) { return this.bindings.get("__pwInteractionEvidence")?.({ page: this, frame }, { epoch: Date.now(), ...item }); }
}
async function fixture(run) {
  const directory = await mkdtemp(path.join(tmpdir(), "interaction-evidence-")), page = new Page(), attachments = [];
  const info = { status: "failed", retry: 0, annotations: [], outputPath: name => path.join(directory, name), attach: async (name, item) => attachments.push({ name, ...item }) };
  const evidence = createInteractionEvidence(info, "wave-gas");
  try { await run({ directory, page, info, evidence, attachments }); }
  finally { await evidence.stop(); await rm(directory, { recursive: true, force: true }); }
}
const readReport = async directory => JSON.parse(await readFile(path.join(directory, "interaction-diagnostics.json"), "utf8"));
const frame = (socket, direction, message) => socket.emit(direction, { payload: JSON.stringify(message) });

test("failure output connects native events to anonymous request/ack/state without payload text", () => fixture(async ({ page, info, evidence, directory, attachments }) => {
  await evidence.observe(page, "guest-1"); page.emit("websocket", page.socket);
  await page.dom({ event: "click", stage: "capture", target: "gas", targetNode: 7, trusted: true, phase: "racing", token: SECRET });
  frame(page.socket, "framesent", { type: "play", requestId: SECRET, revision: 7, matchId: SECRET, value: { action: "drive", gas: true, answer: SECRET }, code: SECRET });
  frame(page.socket, "framereceived", { type: "ack", requestId: SECRET, token: SECRET });
  frame(page.socket, "framereceived", { type: "credential", code: SECRET, actor: SECRET, token: SECRET });
  frame(page.socket, "framereceived", { type: "state", state: { phase: "racing", mode: "wave", revision: 8, race: { me: { gas: true, name: SECRET } } } });
  frame(page.socket, "framereceived", { type: "error", message: "This action is out of date. " + SECRET });
  page.emit("pageerror", new Error(SECRET));
  await finishInteractionEvidence(info);
  const data = await readReport(directory), p = data.pages[0], sent = p.wire.find(e => e.event === "sent");
  assert.equal(sent.request, p.wire.find(e => e.type === "ack").request);
  assert.equal(sent.action, "drive"); assert.equal(sent.gas, true); assert.equal(sent.revision, 7);
  assert.equal(p.wire.find(e => e.type === "state").gas, true);
  assert.equal(p.wire.find(e => e.type === "error").category, "stale");
  assert.equal(p.dom.find(e => e.event === "click").trusted, true);
  assert.ok(!JSON.stringify(data).includes(SECRET)); assert.equal(attachments.length, 1);
}));

test("passing attempts create no diagnostic and idempotent teardown removes all listeners", () => fixture(async ({ page, info, evidence, directory, attachments }) => {
  info.status = "passed"; await evidence.observe(page, "host"); page.emit("websocket", page.socket);
  await evidence.stop(); await evidence.stop(); await finishInteractionEvidence(info); await finishInteractionEvidence(info);
  assert.deepEqual(await readdir(directory), []); assert.deepEqual(attachments, []);
  assert.equal(page.listenerCount("websocket"), 0); assert.equal(page.listenerCount("pageerror"), 0);
  for (const name of ["framesent", "framereceived", "close"]) assert.equal(page.socket.listenerCount(name), 0);
}));

test("floods retain the tail, cap requests/sockets/pages, and drop malformed/private fields", () => fixture(async ({ page, info, evidence, directory }) => {
  await evidence.observe(page, SECRET); page.emit("websocket", page.socket);
  page.socket.emit("framesent", { payload: SECRET }); page.socket.emit("framesent", { payload: "x".repeat(70000) });
  frame(page.socket, "framereceived", { type: "error", message: { toString: null } });
  for (let i = 0; i < 700; i++) {
    frame(page.socket, "framesent", { type: "play", requestId: SECRET + i, value: { action: SECRET, gas: SECRET }, revision: Infinity });
    await page.dom({ event: "dom", phase: SECRET, status: SECRET, nextNode: Infinity, arbitrary: SECRET });
  }
  frame(page.socket, "framesent", { type: "next", revision: 99 });
  await page.dom({ event: "click", target: "host-next", targetNode: 99 });
  for (let i = 0; i < 24; i++) page.emit("websocket", new EventEmitter());
  for (let i = 0; i < 9; i++) await evidence.observe(new Page(), SECRET);
  await finishInteractionEvidence(info); const data = await readReport(directory), p = data.pages[0];
  assert.equal(data.pages.length, 5); assert.ok(data.droppedPages > 0);
  assert.equal(p.wire.length, 256); assert.ok(p.dom.length <= 128); assert.ok(p.dropped.wire > 0); assert.ok(p.dropped.dom > 0); assert.ok(p.dropped.sockets > 0);
  assert.ok(p.wire.some(e => e.type === "next" && e.revision === 99)); assert.ok(p.dom.some(e => e.targetNode === 99));
  assert.ok(p.wire.every(e => !e.request || e.request <= 128));
  assert.ok(!JSON.stringify(data).includes(SECRET)); assert.ok(Buffer.byteLength(JSON.stringify(data)) < 524288);
}));

test("document namespaces survive reloads and subframe records are ignored", () => fixture(async ({ page, info, evidence, directory }) => {
  await evidence.observe(page, "host");
  await page.dom({ event: "document", nextNode: 1 }); await page.dom({ event: "pointerdown", target: "host-next", targetNode: 1 });
  await page.dom({ event: "document", nextNode: 1 }); await page.dom({ event: "click", target: "host-next", targetNode: 1 });
  await page.dom({ event: "click", targetNode: 999 }, {});
  await finishInteractionEvidence(info); const p = (await readReport(directory)).pages[0];
  assert.equal(p.documents, 2); assert.equal(p.dom.find(e => e.event === "pointerdown").document, 1);
  assert.equal(p.dom.find(e => e.event === "click").document, 2); assert.ok(!p.dom.some(e => e.targetNode === 999));
}));

test("capture/attachment failures annotate loss while retaining the original test status", () => fixture(async ({ page, info, evidence }) => {
  page.exposeBinding = async () => { throw new Error(SECRET); };
  await assert.doesNotReject(evidence.observe(page, "host"));
  info.attach = async () => { throw new Error(SECRET); };
  await assert.doesNotReject(finishInteractionEvidence(info));
  assert.equal(info.status, "failed"); assert.ok(info.annotations.length > 0); assert.ok(!JSON.stringify(info.annotations).includes(SECRET));
}));

test("closed or unresponsive pages cannot hold teardown open or replace a timeout", () => fixture(async ({ page, info, evidence, directory }) => {
  info.status = "timedOut"; await evidence.observe(page, "host"); page.emit("websocket", page.socket);
  page.evaluate = () => new Promise(() => {});
  await finishInteractionEvidence(info);
  assert.equal(info.status, "timedOut"); assert.equal(page.socket.listenerCount("framesent"), 0);
  assert.equal((await readReport(directory)).pages[0].captureUnavailable, true);
}));

test("independent attempts cannot mix pages or retain arbitrary scope/role/DOM strings", () => fixture(async ({ page, info, evidence, directory }) => {
  assert.equal(createInteractionEvidence(info, "wave-gas"), evidence);
  const other = { ...info, status: "passed", annotations: [] }, second = createInteractionEvidence(other, SECRET), another = new Page();
  await evidence.observe(page, "host"); await second.observe(another, SECRET);
  await page.dom({ event: SECRET, stage: SECRET, target: SECRET, key: SECRET, phase: SECRET, status: SECRET, targetNode: SECRET });
  await finishInteractionEvidence(other); await finishInteractionEvidence(info);
  const data = await readReport(directory);
  assert.equal(data.pages.length, 1); assert.equal(data.scope, "wave-gas"); assert.ok(!JSON.stringify(data).includes(SECRET));
  assert.equal(another.listenerCount("websocket"), 0);
}));

test("five full page buffers still produce a bounded diagnostic instead of losing the report", () => fixture(async ({ page, info, evidence, directory }) => {
  for (let n = 0; n < 5; n++) {
    const p = n ? new Page() : page; await evidence.observe(p, n ? `guest-${n}` : "host"); p.emit("websocket", p.socket);
    for (let i = 0; i < 400; i++) {
      frame(p.socket, "framesent", { type: "play", requestId: SECRET+i, revision: 999999, value: { action: "drive", gas: true } });
      await p.dom({ event: "pointerdown", stage: "capture", target: "host-next", key: "enter", targetNode: 999999, nextNode: 999999, gasNode: 999999, trusted: true, prevented: false, controllerActive: true, joinErrorVisible: false, nextDisabled: false, gas: true, wordChooserPresent: true, nextX: 100000, nextY: -100000, nextWidth: 100000, nextHeight: 100000, x: 99999.999, y: -99999.999, pointerId: 999999, timerVisible: true });
    }
  }
  await finishInteractionEvidence(info);
  const text = await readFile(path.join(directory, "interaction-diagnostics.json"), "utf8"), data = JSON.parse(text);
  assert.equal(data.pages.length, 5); assert.ok(data.pages.every(p => p.dropped.requestIds > 0));
  assert.ok(Buffer.byteLength(text) < 524288); assert.ok(!text.includes(SECRET));
}));

test("seats attached at different times share one attempt clock for wire and DOM", t => fixture(async ({ info, directory }) => {
  let now = 10000;
  t.mock.method(Date, "now", () => now);
  const attempt = { ...info, annotations: [] }, evidence = createInteractionEvidence(attempt, "doodle-next");
  const host = new Page(), guest = new Page();
  try {
    await evidence.observe(host, "host"); host.emit("websocket", host.socket);
    now = 10250;
    await evidence.observe(guest, "guest-1"); guest.emit("websocket", guest.socket);
    now = 10300;
    frame(host.socket, "framesent", { type: "next", requestId: SECRET, revision: 8 });
    frame(guest.socket, "framereceived", { type: "state", state: { phase: "playing", revision: 9 } });
    await host.dom({ event: "click", target: "host-next", targetNode: 1 });
    await guest.dom({ event: "dom", wordChooserVisible: true });
    await finishInteractionEvidence(attempt);
    const data = await readReport(directory), [h, g] = data.pages;
    assert.equal(h.wire.find(e => e.type === "next").ms, 300);
    assert.equal(g.wire.find(e => e.type === "state").ms, 300);
    assert.equal(h.dom.find(e => e.event === "click").ms, 300);
    assert.equal(g.dom.find(e => e.wordChooserVisible).ms, 300);
    assert.equal(data.schemaVersion, 3);
    assert.equal(data.timeBasis, "attempt-relative");
    assert.ok(!JSON.stringify(data).includes(SECRET));
  } finally { await evidence.stop(); }
}));

test("browser loss across reloads is totaled without counting repeated samples twice", () => fixture(async ({ page, info, evidence, directory }) => {
  await evidence.observe(page, "host");
  await page.dom({ event: "document", browserDropped: 0 });
  await page.dom({ event: "dom", browserDropped: 3 });
  await page.dom({ event: "dom", browserDropped: 3 });
  await page.dom({ event: "document", browserDropped: 0 });
  await page.dom({ event: "dom", browserDropped: 2 });
  await finishInteractionEvidence(info);
  assert.equal((await readReport(directory)).pages[0].dropped.browser, 5);
}));


test("bounded numeric geometry and board state survive without arbitrary fields", () => fixture(async ({ page, info, evidence, directory }) => {
  await evidence.observe(page,"host");page.emit("websocket",page.socket);
  await page.dom({event:"pointerdown",target:"host-next",nextX:1.23456,nextY:-12.34567,nextWidth:1000000,nextHeight:52.99999,x:SECRET,y:NaN,pointerId:9,timerVisible:true,privateText:SECRET});
  frame(page.socket,"framereceived",{type:"state",state:{phase:"reveal",pack:{stage:"board-reveal",round:2},revision:15}});
  await finishInteractionEvidence(info);const data=await readReport(directory),p=data.pages[0],dom=p.dom.find(e=>e.event==="pointerdown");
  assert.equal(data.schemaVersion,3);assert.equal(dom.nextX,1.235);assert.equal(dom.nextY,-12.346);assert.equal(dom.nextWidth,100000);assert.equal(dom.nextHeight,53);
  assert.equal(dom.pointerId,9);assert.equal(dom.timerVisible,true);assert.ok(!("x" in dom));assert.ok(!("y" in dom));
  assert.equal(p.wire.find(e=>e.type==="state").round,2);assert.ok(!JSON.stringify(data).includes(SECRET));
}));
