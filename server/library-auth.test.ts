import { describe, it } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { once } from "node:events";

describe("Family library gate", () => {
  it("fails closed, authenticates with signed HttpOnly cookies, and blocks cross-origin changes", async () => {
    process.env.NODE_ENV = "production";
    process.env.TRIVIA_LIBRARY_PASSWORD = "very-long-private-library-password-for-test";
    process.env.TRIVIA_SESSION_SECRET = "0123456789abcdef0123456789abcdef0123456789abcdef";
    const { registerLibraryAuth, isLibraryAuthorized } = await import("./library-auth");
    const app = express();
    app.use(express.json());
    registerLibraryAuth(app);
    app.get("/api/decks", (_req, res) => res.json([{ title: "Protected Biology" }]));
    app.post("/api/decks", (_req, res) => res.status(201).json({ ok: true }));
    const server = createServer(app);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const port = (server.address() as { port: number }).port;
    const base = `http://127.0.0.1:${port}`;
    try {
      let response = await fetch(base + "/api/auth/session");
      assert.equal((await response.json()).authenticated, false);
      response = await fetch(base + "/api/decks");
      assert.equal(response.status, 401);
      response = await fetch(base + "/api/auth/login", {
        method: "POST", headers: { "content-type": "application/json", Origin: "https://evil.example" },
        body: JSON.stringify({ password: process.env.TRIVIA_LIBRARY_PASSWORD }),
      });
      assert.equal(response.status, 403);
      response = await fetch(base + "/api/auth/login", {
        method: "POST", headers: { "content-type": "application/json", Origin: base },
        body: JSON.stringify({ password: process.env.TRIVIA_LIBRARY_PASSWORD }),
      });
      assert.equal(response.status, 200);
      const rawCookie = response.headers.get("set-cookie");
      assert.ok(rawCookie?.includes("HttpOnly"));
      assert.ok(rawCookie?.includes("SameSite=Strict"));
      assert.ok(rawCookie?.includes("Secure"));
      const cookie = rawCookie!.split(";")[0];
      assert.equal(isLibraryAuthorized(cookie), true);
      response = await fetch(base + "/api/decks", { headers: { Cookie: cookie } });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), [{ title: "Protected Biology" }]);
      response = await fetch(base + "/api/decks", {
        method: "POST", headers: { Cookie: cookie, Origin: "https://evil.example" },
      });
      assert.equal(response.status, 403);
      response = await fetch(base + "/api/auth/logout", {
        method: "POST", headers: { Cookie: cookie, Origin: base },
      });
      assert.equal(response.status, 204);
      assert.match(response.headers.get("set-cookie") || "", /Max-Age=0/);
    } finally {
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  });
});
