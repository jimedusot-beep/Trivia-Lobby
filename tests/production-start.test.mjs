import test from "node:test";
import assert from "node:assert/strict";
import { cp, mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { randomUUID } from "node:crypto";
import { gzipSync } from "node:zlib";
import { setTimeout as delay } from "node:timers/promises";
import { Pool } from "pg";
import WebSocket from "ws";

const databaseUrl = process.env.PRODUCTION_TEST_DATABASE_URL;
assert.ok(databaseUrl, "PRODUCTION_TEST_DATABASE_URL must name a disposable empty PostgreSQL database");
assert.notEqual(databaseUrl, process.env.DATABASE_URL, "Use a separate production test database");

function sourcePdf() {
  const content = "BT /F1 12 Tf 20 50 Td (Production PDF :: Preserved source) Tj ET";
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 100] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>", `<< /Length ${content.length} >>\nstream\n${content}\nendstream`, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"];
  let pdf = "%PDF-1.4\n";
  const offsets = [];
  objects.forEach((body, i) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${i + 1} 0 obj\n${body}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.map(n => String(n).padStart(10, "0") + " 00000 n \n").join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf);
}

function inbox(ws) {
  const queue = [], waiting = [];
  ws.on("message", raw => {
    const message = JSON.parse(raw.toString());
    const i = waiting.findIndex(entry => entry.type === message.type);
    if (i < 0) queue.push(message);
    else waiting.splice(i, 1)[0].done(message.payload);
  });
  return {
    send(type, payload = {}) { ws.send(JSON.stringify({ v: 1, type, payload })); },
    async take(type) {
      const i = queue.findIndex(entry => entry.type === type);
      if (i >= 0) return queue.splice(i, 1)[0].payload;
      return new Promise((resolve, reject) => {
        const entry = { type, done: payload => { clearTimeout(timer); resolve(payload); } };
        const timer = setTimeout(() => {
          waiting.splice(waiting.indexOf(entry), 1);
          reject(new Error("Timed out waiting for production socket event " + type));
        }, 5000);
        waiting.push(entry);
      });
    },
  };
}

test("built production runtime migrates a fresh database and retains private content after restart", { timeout: 120_000 }, async t => {
  const pool = new Pool({ connectionString: databaseUrl, connectionTimeoutMillis: 5000 });
  try {
    const tables = await pool.query("SELECT count(*)::int n FROM pg_tables WHERE schemaname='public'");
    assert.equal(tables.rows[0].n, 0, "Production acceptance requires an empty disposable database");
  } finally { await pool.end(); }

  // Only ship the built artifact, package metadata and installed runtime modules.
  // The production CI job removes devDependencies before starting this test.
  const dir = await mkdtemp(join(tmpdir(), "trivia-production-"));
  const runtime = join(dir, "app");
  await cp(resolve("dist"), join(runtime, "dist"), { recursive: true });
  await cp(resolve("package.json"), join(runtime, "package.json"));
  await symlink(resolve("node_modules"), join(runtime, "node_modules"), "dir");
  const reservation = createServer();
  reservation.listen(0, "127.0.0.1");
  await once(reservation, "listening");
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const base = `http://127.0.0.1:${port}`;
  const env = { ...process.env, DATABASE_URL: databaseUrl, PRIVATE_STORAGE_DIR: join(dir, "originals"), PORT: String(port) };
  // Test the private volume path independently of an operator's optional S3 settings.
  for (const name of Object.keys(env)) if (name.startsWith("S3_")) delete env[name];
  const sockets = new Set();
  let child, output = "";
  const stop = async () => {
    for (const ws of sockets) ws.terminate();
    sockets.clear();
    if (!child || child.exitCode !== null || child.signalCode !== null) return;
    const exited = once(child, "exit");
    child.kill("SIGTERM");
    const timer = setTimeout(() => child.kill("SIGKILL"), 5000);
    try { await exited; } finally { clearTimeout(timer); }
  };
  t.after(async () => { await stop(); await rm(dir, { recursive: true, force: true }); });
  const start = async () => {
    output = "";
    child = spawn(process.execPath, ["dist/start.mjs"], { cwd: runtime, env, stdio: ["ignore", "pipe", "pipe"] });
    child.stdout.on("data", bytes => { output += bytes; });
    child.stderr.on("data", bytes => { output += bytes; });
    for (let i = 0; i < 200; i++) {
      assert.equal(child.exitCode, null, "Production start exited early: " + output);
      try {
        if ((await fetch(base + "/health/ready", { signal: AbortSignal.timeout(1000) })).ok) return;
      } catch {}
      await delay(100);
    }
    assert.fail("Production runtime did not become ready: " + output);
  };
  const request = (path, { method = "GET", body, cookie, headers = {} } = {}) => fetch(base + path, {
    method,
    headers: { Origin: base, ...(cookie ? { Cookie: cookie } : {}), ...(body ? { "Content-Type": "application/json" } : {}), ...headers },
    body: body === undefined ? undefined : Buffer.isBuffer(body) ? body : JSON.stringify(body),
  });
  const open = async cookie => {
    const ws = new WebSocket(base.replace("http:", "ws:") + "/ws", { headers: { Origin: base, ...(cookie ? { Cookie: cookie } : {}) } });
    sockets.add(ws);
    const messages = inbox(ws);
    await once(ws, "open");
    return messages;
  };

  // Invalid configuration fails before a listener or migration is opened, without
  // printing database credentials. This is the same compiled startup entry point.
  const bad = spawn(process.execPath, ["dist/start.mjs"], { cwd: runtime, env: { ...env, PRIVATE_STORAGE_DIR: "", DATABASE_URL: "postgres://hidden-secret@127.0.0.1/nope" }, stdio: ["ignore", "pipe", "pipe"] });
  let failure = "";
  bad.stdout.on("data", bytes => { failure += bytes; });
  bad.stderr.on("data", bytes => { failure += bytes; });
  assert.equal((await once(bad, "exit"))[0], 1);
  assert.match(failure, /Startup failed during configuration.*PRIVATE_STORAGE_DIR/);
  assert.doesNotMatch(failure, /hidden-secret/);

  await start();
  assert.match(output, /Private storage verified/);
  assert.match(output, /Applied 0005_integrated_platform.sql/);
  const home = await request("/");
  assert.equal(home.status, 200);
  const html = await home.text();
  const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"\s]+)"/g)].map(match => match[1]);
  assert.ok(assets.some(path => path.endsWith(".js")) && assets.some(path => path.endsWith(".css")));
  for (const asset of assets) {
    const response = await request(asset);
    assert.equal(response.status, 200, asset);
    assert.doesNotMatch(response.headers.get("content-type") ?? "", /text\/html/);
  }
  for (const path of ["/api/not-a-route", "/assets/missing.js"]) assert.equal((await request(path)).status, 404);
  assert.equal((await request("/api/decks")).status, 401);
  // GHSA-27r3-jxmh-p828: compression must be rejected before decompression,
  // even on unauthenticated endpoints, without bringing down the process.
  const compressedJson = gzipSync(Buffer.from(JSON.stringify({ email: "nobody@example.test", password: "fake" })));
  const rejectedJson = await request("/api/auth/register", { method: "POST", body: compressedJson,
    headers: { "Content-Type": "application/json", "Content-Encoding": "gzip" } });
  assert.equal(rejectedJson.status, 415, "Encoded JSON request bodies must be rejected");
  const compressedForm = gzipSync(Buffer.from("username=example"));
  const rejectedForm = await request("/api/auth/login", { method: "POST", body: compressedForm,
    headers: { "Content-Type": "application/x-www-form-urlencoded", "Content-Encoding": "gzip" } });
  assert.equal(rejectedForm.status, 415, "Encoded forms must be rejected");
  assert.equal((await request("/health/live")).status, 200, "Parser rejection must not crash the process");
  const email = `production-${randomUUID()}@example.test`, password = "Production-restart-passphrase-2026";
  const register = await request("/api/auth/register", { method: "POST", body: { email, password } });
  assert.equal(register.status, 201);
  const setCookie = register.headers.get("set-cookie");
  assert.match(setCookie, /; Secure/i);
  assert.match(setCookie, /; HttpOnly/i);
  assert.match(setCookie, /SameSite=Lax/i);
  const cookie = setCookie.split(";")[0];
  const created = await request("/api/decks", { method: "POST", cookie, body: { title: "Survives production restart" } });
  assert.equal(created.status, 201);
  const deck = await created.json();
  const cards = await request(`/api/decks/${deck.id}/cards`, { method: "POST", cookie, body: [
    { type: "multiple_choice", front: "Two plus two?", back: "Four is correct", options: ["Three", "Four"], correctOption: "B" },
  ] });
  assert.equal(cards.status, 201);
  const original = Buffer.from("Retained production source :: Exact original answer");
  const upload = await request("/api/library/files", { method: "POST", cookie, body: original, headers: { "Content-Type": "application/octet-stream", "X-Filename": "production.txt" } });
  assert.equal(upload.status, 201);
  const file = await upload.json();
  const pdfUpload = await request("/api/library/files", { method: "POST", cookie, body: sourcePdf(), headers: { "Content-Type": "application/octet-stream", "X-Filename": "production.pdf" } });
  assert.equal(pdfUpload.status, 201);
  const pdf = await pdfUpload.json();
  assert.equal(pdf.extractionStatus, "extracted", "PDF worker resolves runtime dependencies from built artifacts");
  const preview = await (await request(`/api/library/files/${pdf.id}/preview`, { cookie })).json();
  assert.match(preview.text, /Production PDF\s*::\s*Preserved source/);

  await stop();
  await start();
  assert.equal((await request("/api/auth/me", { cookie })).status, 200, "Database sessions survive deployment restarts");
  const login = await request("/api/auth/login", { method: "POST", body: { email, password } });
  assert.equal(login.status, 200);
  const freshCookie = login.headers.get("set-cookie").split(";")[0];
  const retained = await request(`/api/library/files/${file.id}/original`, { cookie: freshCookie });
  assert.equal(retained.status, 200);
  assert.deepEqual(Buffer.from(await retained.arrayBuffer()), original);
  assert.equal((await request(`/api/library/files/${file.id}/original`)).status, 401);
  assert.equal((await (await request(`/api/decks/${deck.id}`, { cookie: freshCookie })).json()).cards.length, 1);

  const host = await open(freshCookie), player = await open();
  host.send("create_room", { deckId: deck.id });
  const { roomCode } = await host.take("room_created");
  player.send("join_room", { roomCode, playerName: "Production player" });
  await player.take("room_joined");
  host.send("start_game", { roomCode });
  const question = await player.take("question_start");
  assert.equal(question.prompt, "Two plus two?");
  assert.equal(question.correctOption, undefined);
  assert.equal(question.back, undefined);
  player.send("submit_answer", { roomCode, questionIndex: question.questionIndex, answer: "B" });
  const result = await player.take("answer_result");
  assert.equal(result.isCorrect, true);
  assert.equal(result.awarded, 100);
  host.send("next_question", { roomCode });
  await host.take("leaderboard");
  host.send("next_question", { roomCode });
  assert.equal((await player.take("game_over")).leaderboard[0].score, 100);
});
