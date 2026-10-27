import test from "node:test";
import assert from "node:assert/strict";
import { MemoryRoomCheckpointStore, PostgresRoomCheckpointStore } from "../server/room-checkpoints";
import { deliver, withDeferredDelivery } from "../examples/party-engine/durable-delivery.js";

test("checkpoint reads are detached and stale writers cannot overwrite accepted state", async () => {
  const store = new MemoryRoomCheckpointStore();
  const state = { score: 100, players: [{ name: "Ada" }] };
  assert.equal(await store.save("party", "ABC234", state, Date.now() + 60000, null), 1);
  state.score = 999;
  const first = await store.load("party", "ABC234");
  assert.equal(first?.state.score, 100);
  first!.state.players[0].name = "changed locally";
  assert.equal((await store.load("party", "ABC234"))?.state.players[0].name, "Ada");
  assert.equal(await store.save("party", "ABC234", { score: 200 }, Date.now() + 60000, 1), 2);
  await assert.rejects(store.save("party", "ABC234", { score: 0 }, Date.now() + 60000, 1), /conflict/i);
  assert.equal((await store.load("party", "ABC234"))?.state.score, 200);
  assert.equal(await store.load("quiz", "ABC234"), null);
});

test("expired checkpoints release their code and budgets without resurrecting an old match", async () => {
  let now = 1000;
  const store = new MemoryRoomCheckpointStore({ clock: () => now, maxRoomBytes: 100, maxTotalBytes: 150 });
  await store.save("party", "ABC234", { text: "x".repeat(60) }, 1100, null);
  await assert.rejects(store.save("party", "BCD234", { text: "x".repeat(80) }, 1200, null), /capacity/i);
  await assert.rejects(store.save("party", "BCD234", { text: "x".repeat(100) }, 1200, null), /large/i);
  now = 1101;
  assert.equal(await store.load("party", "ABC234"), null);
  const replacement = await store.save("party", "ABC234", { score: 0 }, 1200, null);
  assert(replacement > 1, "reused codes must fence a writer from the expired room");
  await assert.rejects(store.save("party", "ABC234", { score: 999 }, 1200, 1), /conflict/i);
});

test("a failed checkpoint never releases a success frame or private projection", async () => {
  const frames: string[] = [];
  await assert.rejects(withDeferredDelivery(async () => {
    deliver(() => frames.push("ack"));
    deliver(() => frames.push("score:100"));
  }, async () => { throw new Error("storage offline"); }), /storage offline/);
  assert.deepEqual(frames, []);
  await withDeferredDelivery(async () => {
    deliver(() => frames.push("ack"));
    assert.deepEqual(frames, []);
  }, async () => { frames.push("saved"); });
  assert.deepEqual(frames, ["saved", "ack"]);
});

test("PostgreSQL failures are observable for both transports without exposing private details", async () => {
  const logs: any[] = [];
  const failure = Object.assign(new Error("postgres://secret@private/db SQL PRIVATE_ANSWER"), { code: "ECONNRESET" });
  const pool = { query: async () => { throw failure; } };
  for (const kind of ["party", "quiz"] as const) {
    const store = new PostgresRoomCheckpointStore(pool as any, { emit: (level: string, event: unknown) => logs.push({ level, ...event as object }) } as any);
    await assert.rejects(store.load(kind, "ABC234"), error => error === failure);
    await assert.rejects(store.save(kind, "ABC234", { token: "PRIVATE_TOKEN", answer: "PRIVATE_ANSWER" }, Date.now() + 60000, null), error => error === failure);
    await assert.rejects(store.delete(kind, "ABC234"), error => error === failure);
    await assert.rejects(store.prune(), error => error === failure);
  }
  assert.equal(logs.length, 8, "each storage boundary must report its failure");
  for (const event of logs) {
    assert.equal(event.event, "room_checkpoint_failed");
    assert.equal(event.level, "error");
    assert.equal(event.errorCategory, "connection");
    assert.equal(event.errorCode, "ECONNRESET");
    assert(Number.isFinite(event.durationMs));
  }
  assert.deepEqual(logs.slice(0, 4).map(x => x.operation), ["load", "save", "delete", "prune"]);
  assert.deepEqual(logs.filter(x => x.operation === "save").map(x => x.transport), ["party", "quiz"]);
  assert.doesNotMatch(JSON.stringify(logs), /secret|private|PRIVATE_|ABC234|postgres:|SELECT|DELETE/);
  assert.match(logs[0].roomRef, /^[a-f0-9]{16}$/);
});

test("slow checkpoints warn while returning the original successful result", async () => {
  let now = 0;
  const logs: any[] = [];
  const pool = { query: async () => { now += 375; return { rows: [{ version: 7 }] }; } };
  const store = new PostgresRoomCheckpointStore(pool as any, { clock: () => now, emit: (level: string, event: object) => logs.push({ level, ...event }) } as any);
  assert.equal(await store.save("party", "ABC234", { score: 100 }, Date.now() + 60000, null), 7);
  assert.equal(logs.length, 1);
  assert.equal(logs[0].event, "room_checkpoint_slow");
  assert.equal(logs[0].level, "warn");
  assert.equal(logs[0].durationMs, 375);
});

test("repeated failures across room codes are bounded and report suppressed counts", async () => {
  let now = 0;
  const logs: any[] = [];
  const failure = new Error("Room checkpoint conflict");
  const store = new PostgresRoomCheckpointStore({ query: async () => { throw failure; } } as any,
    { clock: () => now, emit: (_: string, event: object) => logs.push(event) } as any);
  for (let i = 0; i < 100; i++) await assert.rejects(store.load("quiz", String(i)), error => error === failure);
  assert.equal(logs.length, 1);
  now = 30000;
  await assert.rejects(store.load("quiz", "ABC234"), error => error === failure);
  assert.equal(logs.length, 2);
  assert.equal(logs[1].suppressed, 99);
  assert.equal(logs[1].errorCategory, "conflict");
});

test("a failing diagnostics sink cannot change checkpoint success or the original rejection", async () => {
  let now = 0;
  let failure: Error | undefined;
  const store = new PostgresRoomCheckpointStore({ query: async () => {
    now += 500;
    if (failure) throw failure;
    return { rows: [{ version: 11 }] };
  } } as any, { clock: () => now, emit: () => { throw new Error("log sink offline"); } } as any);
  assert.equal(await store.save("party", "ABC234", {}, Date.now() + 60000, null), 11);
  failure = new Error("real database failure");
  await assert.rejects(store.load("party", "ABC234"), error => error === failure);
});

test("unknown provider codes and local checkpoint validation never leak raw errors", async () => {
  const logs: any[] = [];
  const store = new PostgresRoomCheckpointStore({ query: async () => { throw Object.assign(new Error("PRIVATE_ERROR"), { code: "PRIVATE_CODE" }); } } as any,
    { emit: (_: string, event: object) => logs.push(event) } as any);
  await assert.rejects(store.load("party", "ABC234"));
  await assert.rejects(store.save("party", "ABC234", {}, 0, null), /expiry/);
  assert.equal(logs[0].errorCategory, "unknown");
  assert.equal(logs[0].errorCode, undefined);
  assert.equal(logs[1].errorCategory, "invalid_expiry");
  assert.doesNotMatch(JSON.stringify(logs), /PRIVATE/);
});
