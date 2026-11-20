import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { withJoinEvidence } from "../browser-specs/helpers/join-evidence.js";

const SECRET = "SYNTHETIC-CREDENTIAL-DO-NOT-RECORD";
class Page extends EventEmitter {
  socket = new EventEmitter();
  calls = 0;
  async goto() { this.emit("websocket", this.socket); }
  async evaluate() {
    if (++this.calls === 1) return;
    return { events: [{ ms: 12, event: "submit", status: SECRET, phase: "lobby", token: SECRET }],
      snapshot: { controllerActive: false, phase: SECRET, url: SECRET }, dropped: 0 };
  }
}
async function fixture(run) {
  const directory = await mkdtemp(path.join(tmpdir(), "join-evidence-"));
  const page = new Page(), attachments = [];
  const info = { retry: 0, annotations: [], outputPath: name => path.join(directory, name),
    attach: async (name, item) => attachments.push({ name, ...item }) };
  try { await run({ directory, page, info, attachments }); }
  finally { await rm(directory, { recursive: true, force: true }); }
}

test("failed joins preserve bounded allowlisted evidence without credential or arbitrary text", () => fixture(async ({ page, info, directory, attachments }) => {
  const original = new Error(SECRET);
  await assert.rejects(withJoinEvidence(page, info, `http://local.invalid/?token=${SECRET}`, async () => {
    page.socket.emit("framesent", { payload: JSON.stringify({ type: "join", code: SECRET, name: SECRET }) });
    page.socket.emit("framereceived", { payload: JSON.stringify({ type: "credential", token: SECRET }) });
    page.socket.emit("framereceived", { payload: JSON.stringify({ type: "state", state: { phase: SECRET, token: SECRET } }) });
    page.emit("pageerror", new Error(SECRET));
    throw original;
  }), error => error === original);
  const text = await readFile(path.join(directory, "join-diagnostics.json"), "utf8"), report = JSON.parse(text);
  assert.ok(!text.includes(SECRET));
  assert.ok(report.events.some(e => e.event === "sent" && e.type === "join"));
  assert.ok(report.events.some(e => e.type === "credential"));
  assert.ok(report.events.some(e => e.event === "pageerror"));
  assert.equal(report.dom.events[0].status, "other");
  assert.equal(attachments.length, 1);
  assert.equal(page.listenerCount("websocket"), 0);
  assert.equal(page.socket.listenerCount("framesent"), 0);
}));

test("successful joins create no evidence file and dispose listeners", () => fixture(async ({ page, info, directory, attachments }) => {
  assert.equal(await withJoinEvidence(page, info, "http://local.invalid", async () => "joined"), "joined");
  assert.deepEqual(await readdir(directory), []);
  assert.deepEqual(attachments, []);
  assert.equal(page.listenerCount("pageerror"), 0);
  assert.equal(page.socket.listenerCount("framereceived"), 0);
}));

test("frame floods, malformed payloads and oversized frames cannot grow or leak evidence", () => fixture(async ({ page, info, directory }) => {
  await assert.rejects(withJoinEvidence(page, info, "http://local.invalid", async () => {
    page.socket.emit("framesent", { payload: SECRET });
    page.socket.emit("framesent", { payload: JSON.stringify({ type: SECRET, extra: "x".repeat(70000) }) });
    for (let i = 0; i < 200; i++) page.socket.emit("framereceived", { payload: JSON.stringify({ type: "pong", token: SECRET }) });
    throw new Error("controlled failure");
  }));
  const text = await readFile(path.join(directory, "join-diagnostics.json"), "utf8"), report = JSON.parse(text);
  assert.equal(report.events.length, 64);
  assert.ok(report.dropped > 0);
  assert.ok(text.length < 16384);
  assert.ok(!text.includes(SECRET));
}));

test("attachment failures annotate capture loss and retain the exact original error", () => fixture(async ({ page, info }) => {
  const original = new Error("original join failure");
  info.attach = async () => { throw new Error(SECRET); };
  await assert.rejects(withJoinEvidence(page, info, "http://local.invalid", async () => { throw original; }), error => error === original);
  assert.equal(info.annotations[0].type, "join-diagnostics-unavailable");
  assert.ok(!JSON.stringify(info.annotations).includes(SECRET));
}));

test("navigation failure is captured without copying the URL or replacing the failure", () => fixture(async ({ page, info, directory }) => {
  const original = new Error(SECRET);
  page.goto = async () => { throw original; };
  await assert.rejects(withJoinEvidence(page, info, `http://local.invalid/${SECRET}`, async () => {}), error => error === original);
  const text = await readFile(path.join(directory, "join-diagnostics.json"), "utf8");
  assert.ok(!text.includes(SECRET));
  assert.equal(page.listenerCount("websocket"), 0);
}));
