import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createFamilyTransitionEvidence, finishFamilyTransitionEvidence } from "../browser-specs/helpers/family-transition-evidence.js";

const SECRET = "SYNTHETIC-SECRET-DO-NOT-RECORD";
class Page extends EventEmitter {
  socket = new EventEmitter();
  bindings = new Map();
  async exposeBinding(name, fn) { this.bindings.set(name, fn); }
  async addInitScript() {}
  async evaluate() { return { phase: "reveal", status: "accepted", round: 2, nextId: 2, nextDisabled: false }; }
  dom(event) { return this.bindings.get("__pwFamilyTransition")?.({}, { epoch: Date.now(), ...event }); }
}
async function fixture(run) {
  const directory = await mkdtemp(path.join(tmpdir(), "family-evidence-")), page = new Page(), attachments = [];
  const info = { status: "failed", retry: 0, annotations: [], outputPath: name => path.join(directory, name), attach: async (name, item) => attachments.push({ name, ...item }) };
  const evidence = createFamilyTransitionEvidence(info);
  try { await run({ directory, page, info, evidence, attachments }); }
  finally { await evidence.stop(); await rm(directory, { recursive: true, force: true }); }
}
const report = async directory => JSON.parse(await readFile(path.join(directory, "family-transition-diagnostics.json"), "utf8"));

test("failed transition output correlates anonymous requests and strips unsafe wire/DOM data", () => fixture(async ({ page, info, evidence, directory }) => {
  await evidence.observe(page, "host"); page.emit("websocket", page.socket);
  page.socket.emit("framesent", { payload: JSON.stringify({ type: "next", requestId: SECRET, revision: 7, token: SECRET, url: SECRET }) });
  page.socket.emit("framereceived", { payload: JSON.stringify({ type: "ack", requestId: SECRET, code: SECRET }) });
  page.socket.emit("framereceived", { payload: JSON.stringify({ type: "state", state: { phase: SECRET, pack: { stage: SECRET }, revision: SECRET } }) });
  await page.dom({ event: "click", phase: SECRET, status: SECRET, target: "next", nextId: 1, nextDisabled: false, extra: SECRET });
  await finishFamilyTransitionEvidence(info);
  const data = await report(directory), text = JSON.stringify(data), events = data.pages[0].wire;
  assert.ok(!text.includes(SECRET)); assert.equal(events[0].type, "next"); assert.equal(events[0].request, events[1].request);
  assert.equal(data.pages[0].dom[0].status, "other"); assert.equal(data.pages[0].dom[0].phase, "other");
}));

test("successful attempts write no diagnostic or attachment and dispose wire listeners", () => fixture(async ({ page, info, evidence, directory, attachments }) => {
  info.status = "passed"; await evidence.observe(page, "host"); page.emit("websocket", page.socket);
  await finishFamilyTransitionEvidence(info);
  assert.deepEqual(await readdir(directory), []); assert.deepEqual(attachments, []);
  assert.equal(page.listenerCount("websocket"), 0); assert.equal(page.socket.listenerCount("framesent"), 0);
}));

test("DOM pointer history and document identity survive an intentional host reload", () => fixture(async ({ page, info, evidence, directory }) => {
  await evidence.observe(page, "host");
  await page.dom({ event: "document", phase: "playing" }); await page.dom({ event: "pointerdown", phase: "reveal", nextId: 2, targetId: 2 });
  await page.dom({ event: "document", phase: "playing" }); await page.dom({ event: "click", phase: "reveal", nextId: 1, targetId: 1 });
  await finishFamilyTransitionEvidence(info); const data = (await report(directory)).pages[0];
  assert.equal(data.documents, 2); assert.equal(data.dom.find(e => e.event === "pointerdown").document, 1); assert.equal(data.dom.find(e => e.event === "click").document, 2);
}));

test("wire/DOM floods and malformed or oversized frames stay bounded and private", () => fixture(async ({ page, info, evidence, directory }) => {
  await evidence.observe(page, "host"); page.emit("websocket", page.socket);
  page.socket.emit("framesent", { payload: SECRET }); page.socket.emit("framesent", { payload: "x".repeat(70000) });
  assert.doesNotThrow(() => page.socket.emit("framereceived", { payload: JSON.stringify({ type: "error", message: { toString: null } }) }));
  await page.dom({ event: "dom", epoch: { valueOf: null, toString: null }, extra: SECRET });
  for (let i = 0; i < 600; i++) {
    page.socket.emit("framesent", { payload: JSON.stringify({ type: "next", requestId: `${SECRET}-${i}` }) });
    await page.dom({ event: "click", status: SECRET, phase: SECRET, nextId: Infinity, extra: SECRET });
  }
  await finishFamilyTransitionEvidence(info); const data = await report(directory), p = data.pages[0];
  assert.ok(p.wire.length <= 256); assert.ok(p.dom.length <= 128); assert.ok(p.dropped.wire > 0); assert.ok(p.dropped.dom > 0);
  assert.ok(JSON.stringify(data).length < 100000); assert.ok(!JSON.stringify(data).includes(SECRET));
}));

test("attachment loss is annotated without throwing or changing the failed status", () => fixture(async ({ page, info, evidence }) => {
  await evidence.observe(page, "host"); info.attach = async () => { throw new Error(SECRET); };
  await assert.doesNotReject(finishFamilyTransitionEvidence(info));
  assert.equal(info.status, "failed"); assert.equal(info.annotations[0].type, "family-transition-evidence-unavailable"); assert.ok(!JSON.stringify(info.annotations).includes(SECRET));
}));

test("stop/finalize are idempotent and late events do not enter the output", () => fixture(async ({ page, info, evidence, directory, attachments }) => {
  await evidence.observe(page, "host"); page.emit("websocket", page.socket);
  await Promise.all([evidence.stop(), evidence.stop()]); page.socket.emit("framesent", { payload: JSON.stringify({ type: "next" }) });
  await finishFamilyTransitionEvidence(info); await finishFamilyTransitionEvidence(info);
  assert.equal((await report(directory)).pages[0].wire.length, 0); assert.equal(attachments.length, 1);
}));

test("observer setup loss is best effort and preserves the test's status", () => fixture(async ({ page, info, evidence, directory }) => {
  page.addInitScript = async () => { throw new Error(SECRET); };
  await assert.doesNotReject(evidence.observe(page, "host")); await finishFamilyTransitionEvidence(info);
  assert.equal(info.status, "failed"); assert.equal((await report(directory)).pages[0].captureUnavailable, true); assert.ok(!JSON.stringify(info.annotations).includes(SECRET));
}));

test("an unresponsive DOM cannot block bounded evidence cleanup", () => fixture(async ({ page, info, evidence, directory }) => {
  page.evaluate = async () => new Promise(() => {}); await evidence.observe(page, "host");
  await finishFamilyTransitionEvidence(info); assert.equal((await report(directory)).pages[0].captureUnavailable, true);
}));
