import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// Run against an isolated, migrated Postgres instance:
// STUDY_TEST_DATABASE_URL=postgres://... npm test
// Skipped in generic CI where no PostgreSQL service is provisioned.
test("private history, idempotent reviews and cross-device reload", { skip: !process.env.STUDY_TEST_DATABASE_URL }, async () => {
  process.env.DATABASE_URL = process.env.STUDY_TEST_DATABASE_URL;
  const { default: express } = await import("express");
  const { registerStudyRoutes } = await import("./study-routes");
  const { db, pool } = await import("./db");
  const { decks, cards, studyAccounts } = await import("@shared/schema");
  const { eq } = await import("drizzle-orm");
  const app = express();
  app.use(express.json());
  registerStudyRoutes(app);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test address");
  const origin = `http://127.0.0.1:${address.port}`;
  const suffix = randomUUID();
  const created: string[] = [];
  let deckId = -1;
  let cardId = -1;
  const send = async (path: string, method = "GET", body?: unknown, cookie?: string) => {
    const response = await fetch(origin + path, {
      method, headers: { ...(body ? { "Content-Type": "application/json", Origin: origin } : {}), ...(cookie ? { Cookie: cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: response.status, value: await response.json().catch(() => ({})), cookie: response.headers.get("set-cookie")?.split(";")[0] };
  };
  try {
    const [deck] = await db.insert(decks).values({ title: "study-test-" + suffix, category: "Privacy Tests" }).returning();
    deckId = deck.id;
    const [card] = await db.insert(cards).values({ deckId, type: "flashcard", front: "Privacy test?", back: "Account scoped" }).returning();
    cardId = card.id;
    const a = await send("/api/study/auth/register", "POST", { email: `a-${suffix}@example.com`, password: "safe-long-test-passphrase" });
    const b = await send("/api/study/auth/register", "POST", { email: `b-${suffix}@example.com`, password: "safe-long-test-passphrase" });
    assert.equal(a.status, 201); assert.equal(b.status, 201);
    created.push(a.value.id, b.value.id);
    assert.ok(a.cookie); assert.ok(b.cookie);
    const unauth = await send("/api/study/history");
    assert.equal(unauth.status, 401);
    const requestId = randomUUID();
    const first = await send("/api/study/review", "POST", { cardId, rating: 1, requestId }, a.cookie!);
    assert.equal(first.status, 201);
    const replay = await send("/api/study/review", "POST", { cardId, rating: 1, requestId }, a.cookie!);
    assert.equal(replay.status, 200); assert.equal(replay.value.replay, true);
    const conflicted = await send("/api/study/review", "POST", { cardId, rating: 4, requestId }, a.cookie!);
    assert.equal(conflicted.status, 409, "a retry key cannot silently change a past rating");
    const historyA = await send("/api/study/history", "GET", undefined, a.cookie!);
    const historyB = await send("/api/study/history", "GET", undefined, b.cookie!);
    assert.equal(historyA.value.events.length, 1);
    assert.equal(historyA.value.wrongAnswers.length, 1);
    assert.equal(historyA.value.wrongAnswers[0].cardId, cardId);
    assert.equal(historyB.value.events.length, 0);
    assert.equal(historyB.value.wrongAnswers.length, 0);
    const aQueue = await send(`/api/study/queue?deckId=${deckId}&mode=missed`, "GET", undefined, a.cookie!);
    const bQueue = await send(`/api/study/queue?deckId=${deckId}&mode=missed`, "GET", undefined, b.cookie!);
    assert.equal(aQueue.value.cards.length, 1);
    assert.equal(bQueue.value.cards.length, 0);
    // Independent sign-in on a second device reads the same database-backed review state.
    const deviceB = await send("/api/study/auth/login", "POST", { email: `a-${suffix}@example.com`, password: "safe-long-test-passphrase" });
    assert.equal(deviceB.status, 200);
    const secondDeviceHistory = await send("/api/study/history", "GET", undefined, deviceB.cookie!);
    assert.equal(secondDeviceHistory.value.events.length, 1);
    const exportA = await send("/api/study/export", "GET", undefined, deviceB.cookie!);
    assert.equal(exportA.value.events.length, 1);
    assert.equal(exportA.value.states.length, 1);
    const invalidOrigin = await fetch(origin + "/api/study/review", {
      method: "POST", headers: { Origin: "https://attacker.example", Cookie: a.cookie!, "Content-Type": "application/json" },
      body: JSON.stringify({ cardId, rating: 1, requestId: randomUUID() }),
    });
    assert.equal(invalidOrigin.status, 403, "reject cross-origin review mutation");
    const resolved = await send("/api/study/review", "POST", { cardId, rating: 3, requestId: randomUUID() }, deviceB.cookie!);
    assert.equal(resolved.status, 201);
    const afterRetry = await send(`/api/study/queue?deckId=${deckId}&mode=missed`, "GET", undefined, a.cookie!);
    assert.equal(afterRetry.value.cards.length, 0);
  } finally {
    for (const id of created) await db.delete(studyAccounts).where(eq(studyAccounts.id, id));
    if (cardId > 0) await db.delete(cards).where(eq(cards.id, cardId));
    if (deckId > 0) await db.delete(decks).where(eq(decks.id, deckId));
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await pool.end();
  }
});
