import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";
import { PostgresRoomCheckpointStore } from "../server/room-checkpoints";

// Explicit test database only; never discover or use production credentials.
const connectionString = process.env.TEST_DATABASE_URL;
test("PostgreSQL checkpoints atomically fence competing writers, expire and enforce free-tier budgets", { skip: !connectionString }, async () => {
  const admin = new pg.Pool({ connectionString });
  const schema = `room_recovery_${randomBytes(6).toString("hex")}`;
  await admin.query(`CREATE SCHEMA "${schema}"`);
  const pool = new pg.Pool({ connectionString, options: `-c search_path=${schema},public`, max: 4 });
  try {
    await pool.query(await readFile(new URL("../migrations/0009_live_room_checkpoints.sql", import.meta.url), "utf8"));
    const store = new PostgresRoomCheckpointStore(pool);
    const first = await store.save("quiz", "ABC234", { score: 100 }, Date.now() + 60000, null);
    const contenders = await Promise.allSettled([
      store.save("quiz", "ABC234", { score: 200 }, Date.now() + 60000, first),
      store.save("quiz", "ABC234", { score: 300 }, Date.now() + 60000, first),
    ]);
    assert.equal(contenders.filter(result => result.status === "fulfilled").length, 1);
    const accepted = await store.load("quiz", "ABC234"); assert(accepted);
    assert([200, 300].includes(accepted.state.score));
    await assert.rejects(store.save("quiz", "ABC234", { score: 999 }, Date.now() + 60000, first), /conflict/i);
    await pool.query("UPDATE live_room_checkpoints SET expires_at=clock_timestamp()-interval '1 second' WHERE code='ABC234'");
    assert.equal(await store.load("quiz", "ABC234"), null);
    const replacement = await store.save("quiz", "ABC234", { score: 0 }, Date.now() + 60000, null);
    assert(replacement > accepted.version);
    await store.delete("quiz", "ABC234", accepted.version);
    assert.equal((await store.load("quiz", "ABC234"))?.state.score, 0);
    await assert.rejects(store.save("quiz", "ABC234", { score: 999 }, Date.now() + 60000, accepted.version), /conflict/i);
    const block = { text: "x".repeat(4 * 1024 * 1024 - 128) };
    for (let i = 0; i < 8; i++) await store.save("party", `ZZZZZ${i + 2}`, block, Date.now() + 60000, null);
    await assert.rejects(store.save("party", "YYYYY2", block, Date.now() + 60000, null), /capacity/i);
    assert.equal((await store.load("quiz", "ABC234"))?.state.score, 0);
    await assert.rejects(store.save("party", "YYYYY3", { text: "x".repeat(4 * 1024 * 1024) }, Date.now() + 60000, null), /large/i);
  } finally {
    await pool.end();
    await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
    await admin.end();
  }
});
