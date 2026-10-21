import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import express from "express";
import { pool } from "../server/db";
import { registerRoutes } from "../server/routes";
import { exportDeckJson, parseDeckContent } from "../client/src/lib/deck-io";

const enabled = process.env.TEST_DATABASE_URL && process.env.DATABASE_URL === process.env.TEST_DATABASE_URL;
describe("private library HTTP integration (dedicated disposable database required)", { skip: !enabled }, () => {
  it("enforces ownership and retains originals across sessions with review and linked decks", async () => {
    const dir = await mkdtemp(join(tmpdir(), "trivia-phase3-"));
    process.env.PRIVATE_STORAGE_DIR = dir;
    const app = express();
    app.use(express.json());
    const server = createServer(app);
    await registerRoutes(server, app);
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as { port: number }).port;
    const base = "http://127.0.0.1:" + port;
    const emailSuffix = Date.now() + "-" + Math.random().toString(36).slice(2);
    async function request(method: string, path: string, cookie?: string, body?: unknown, extra?: Record<string, string>) {
      const headers: Record<string, string> = { ...extra };
      if (cookie) headers.Cookie = cookie;
      const payload = body === undefined ? undefined : Buffer.isBuffer(body) ? body : JSON.stringify(body);
      if (payload && !Buffer.isBuffer(body)) headers["Content-Type"] = "application/json";
      const res = await fetch(base + path, { method, headers, body: payload });
      const data = await res.json().catch(() => null);
      return { res, data, cookie: res.headers.get("set-cookie")?.split(";")[0] || "" };
    }
    try {
      assert.equal((await request("GET", "/api/decks")).res.status, 401);
      const alice = await request("POST", "/api/auth/register", undefined, { email: "alice-" + emailSuffix + "@example.test", password: "SuperSecurePassphrase-2026" });
      const bob = await request("POST", "/api/auth/register", undefined, { email: "bob-" + emailSuffix + "@example.test", password: "SuperSecurePassphrase-2026" });
      assert.equal(alice.res.status, 201);
      assert.equal(bob.res.status, 201);
      assert.ok(alice.cookie.startsWith("tl_session="));
      assert.ok(bob.cookie.startsWith("tl_session="));
      const c1 = alice.cookie, c2 = bob.cookie;
      const created = await request("POST", "/api/decks", c1, { title: "Owner-only deck", category: "Course" });
      assert.equal(created.res.status, 201);
      const deckId = created.data.id;
      assert.equal((await request("GET", "/api/decks/" + deckId, c2)).res.status, 404);
      assert.equal((await request("DELETE", "/api/decks/" + deckId, c2)).res.status, 404);
      assert.equal((await request("POST", "/api/decks/" + deckId + "/cards", c2, [{ front: "Wrong", back: "Person", deckId }])).res.status, 404);
      assert.equal((await request("GET", "/api/decks", c2)).data.length, 0);
      assert.equal((await request("POST", "/api/decks", c1, { title: "Cross-site blocked" }, { Origin: "https://evil.example" })).res.status, 403);

      const bytes = Buffer.from("Question :: Answer\nAnother\tResponse");
      const uploadHeaders = { "Content-Type": "application/octet-stream", "X-Filename": "course.txt" };
      const uploaded = await request("POST", "/api/library/files", c1, bytes, uploadHeaders);
      assert.equal(uploaded.res.status, 201);
      const id = uploaded.data.id;
      assert.equal(uploaded.data.objectKey, undefined);
      assert.equal((await request("POST", "/api/library/files", c1, bytes, uploadHeaders)).res.status, 409);
      assert.equal((await request("GET", "/api/library/files/" + id + "/preview", c2)).res.status, 404);
      assert.equal((await request("GET", "/api/library/files/" + id + "/original", c2)).res.status, 404);
      assert.equal((await request("GET", "/api/library/files", c2)).data.length, 0);
      const preview = await request("GET", "/api/library/files/" + id + "/preview", c1);
      assert.equal(preview.data.cards.length, 2);
      assert.equal(preview.data.cards[0].sourceRef, "line 1");
      const approved = await request("POST", "/api/library/files/" + id + "/decks", c1, {
        deck: { title: "Linked lecture", category: "Course" },
        cards: preview.data.cards.map((c: { front: string; back: string }) => ({ front: c.front, back: c.back, type: "flashcard", options: [], correctOption: null })),
      });
      assert.equal(approved.res.status, 201);
      const linkedDeckId = approved.data.id;
      const linked = await request("GET", "/api/decks/" + linkedDeckId, c1);
      assert.equal(linked.data.cards.length, 2);
      assert.equal((await request("GET", "/api/decks/" + linkedDeckId, c2)).res.status, 404);

      // Restore a portable card-deck backup while retaining the original source separately.
      const cardBackup = exportDeckJson(linked.data);
      const parsedBackup = parseDeckContent(cardBackup, "restored.json");
      const restoredDeck = await request("POST", "/api/decks/import", c1, {
        deck: { title: parsedBackup.title, description: parsedBackup.description, category: parsedBackup.category },
        cards: parsedBackup.cards,
      });
      assert.equal(restoredDeck.res.status, 201);
      assert.equal((await request("GET", "/api/decks/" + restoredDeck.data.id, c1)).data.cards.length, 2);

      const download = await fetch(base + "/api/library/files/" + id + "/original", { headers: { Cookie: c1 } });
      assert.equal(download.status, 200);
      assert.deepEqual(Buffer.from(await download.arrayBuffer()), bytes);
      assert.match(download.headers.get("content-disposition") || "", /attachment/);

      const invalid = await request("POST", "/api/library/files", c1, Buffer.from("not a PDF"), { "Content-Type": "application/octet-stream", "X-Filename": "malicious.pdf" });
      assert.equal(invalid.res.status, 422);
      const rollback = await request("POST", "/api/library/files/00000000-0000-0000-0000-000000000000/decks", c1, {
        deck: { title: "Should not exist" }, cards: [{ front: "A", back: "B", type: "flashcard" }],
      });
      assert.equal(rollback.res.status, 404);
      assert.equal((await request("GET", "/api/decks", c1)).data.some((d: { title: string }) => d.title === "Should not exist"), false);

      assert.equal((await request("POST", "/api/auth/logout", c1)).res.status, 204);
      assert.equal((await request("GET", "/api/library/files", c1)).res.status, 401);
      // Second session mimics another browser/device (same database and private volume).
      const login = await request("POST", "/api/auth/login", undefined, { email: "alice-" + emailSuffix + "@example.test", password: "SuperSecurePassphrase-2026" });
      assert.equal(login.res.status, 200);
      assert.equal((await request("GET", "/api/decks/" + linkedDeckId, login.cookie)).res.status, 200);
      assert.equal((await request("GET", "/api/library/files/" + id + "/original", login.cookie)).res.status, 200);
      assert.equal((await request("DELETE", "/api/library/files/" + id, login.cookie)).res.status, 204);
      assert.equal((await request("GET", "/api/library/files/" + id + "/original", login.cookie)).res.status, 404);
      assert.equal((await request("GET", "/api/decks/" + linkedDeckId, login.cookie)).res.status, 200);
    } finally {
      await new Promise<void>(resolve => server.close(() => resolve()));
      await pool.end();
      await rm(dir, { recursive: true, force: true });
    }
  });
});
