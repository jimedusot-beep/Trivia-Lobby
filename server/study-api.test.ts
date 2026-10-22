import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// Run against an isolated, migrated Postgres instance:
// STUDY_TEST_DATABASE_URL=postgres://... npm test
// Skipped in generic CI where no PostgreSQL service is provisioned.
test("private history, idempotent reviews and cross-device reload", { skip: !process.env.STUDY_TEST_DATABASE_URL }, async () => {
  process.env.DATABASE_URL = process.env.STUDY_TEST_DATABASE_URL;
  const { default: express } = await import("express");
  const { registerRoutes } = await import("./routes");
  const { createServer } = await import("node:http");
  const { registerStudyRoutes } = await import("./study-routes");
  const { db, pool } = await import("./db");
  const { decks, cards, users, studySources, studyDrafts } = await import("@shared/schema");
  const { eq } = await import("drizzle-orm");
  const app = express();
  app.use(express.json());
  const server = createServer(app);
  await registerRoutes(server,app);
  server.listen(0,"127.0.0.1");
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
    const a = await send("/api/auth/register", "POST", { email: `a-${suffix}@example.com`, password: "safe-long-test-passphrase" });
    const b = await send("/api/auth/register", "POST", { email: `b-${suffix}@example.com`, password: "safe-long-test-passphrase" });
    assert.equal(a.status, 201); assert.equal(b.status, 201);
    created.push(a.value.id, b.value.id);
    assert.ok(a.cookie); assert.ok(b.cookie);
    const unauth = await send("/api/study/history");
    assert.equal(unauth.status, 401);
    await db.update(decks).set({ownerId:a.value.id}).where(eq(decks.id,deckId));
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
    const sourceId = randomUUID();
    const draftId = randomUUID();
    await db.insert(studySources).values({
      id: sourceId, userId: a.value.id, title: "Private astronomy text",
      body: "Planetary astronomy is the study of planets, moons, and planetary systems. ".repeat(2),
    });
    await db.insert(studyDrafts).values({
      id: draftId, userId: a.value.id, sourceId, front: "What is planetary astronomy?",
      back: "The study of planets", evidence: "the study of planets",
    });
    const sourcesA = await send("/api/study/sources", "GET", undefined, a.cookie!);
    const sourcesB = await send("/api/study/sources", "GET", undefined, b.cookie!);
    assert.equal(sourcesA.value.length, 1);
    assert.equal(sourcesB.value.length, 0, "cross-account source list must be empty");
    const draftsB = await send("/api/study/drafts", "GET", undefined, b.cookie!);
    assert.equal(draftsB.value.length, 0);
    const forbiddenApproval = await send(`/api/study/drafts/${draftId}`, "PATCH", {
      front: "What is planetary astronomy?", back: "Studying planets", approved: true,
    }, b.cookie!);
    assert.equal(forbiddenApproval.status, 404, "another user may not edit the draft");
    const approvedByOwner = await send(`/api/study/drafts/${draftId}`, "PATCH", {
      front: "What is planetary astronomy?", back: "Studying planets", approved: true,
    }, a.cookie!);
    assert.equal(approvedByOwner.status, 200);
    assert.equal(approvedByOwner.value.approved, true);
    const aQueue = await send(`/api/study/queue?deckId=${deckId}&mode=missed`, "GET", undefined, a.cookie!);
    const bQueue = await send(`/api/study/queue?deckId=${deckId}&mode=missed`, "GET", undefined, b.cookie!);
    assert.equal(aQueue.value.cards.length, 1);
    assert.equal(bQueue.value.cards.length, 0);
    // Independent sign-in on a second device reads the same database-backed review state.
    const deviceB = await send("/api/auth/login", "POST", { email: `a-${suffix}@example.com`, password: "safe-long-test-passphrase" });
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
    if (cardId > 0) await db.delete(cards).where(eq(cards.id, cardId));
    if (deckId > 0) await db.delete(decks).where(eq(decks.id, deckId));
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    for (const id of created) await db.delete(users).where(eq(users.id, id));
    await pool.end();
  }
});
