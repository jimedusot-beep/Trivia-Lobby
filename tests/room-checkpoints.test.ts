import test from "node:test";
import assert from "node:assert/strict";
import { MemoryRoomCheckpointStore } from "../server/room-checkpoints";
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
