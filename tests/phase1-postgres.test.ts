import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";

const conn = process.env.DATABASE_URL;
test("Phase 1 foreign-key migration blocks orphan records, cascades, and rolls back on failure", { skip: !conn }, async () => {
  const client = new pg.Client({ connectionString: conn });
  const schemaName = "phase1_" + randomBytes(6).toString("hex");
  await client.connect();
  try {
    await client.query('CREATE SCHEMA "' + schemaName + '"');
    await client.query('SET search_path TO "' + schemaName + '"');
    await client.query("CREATE TABLE decks(id INT PRIMARY KEY)");
    await client.query("CREATE TABLE cards(id INT PRIMARY KEY, deck_id INT NOT NULL)");
    const sql = await readFile(new URL("../migrations/phase1_cards_fk.sql", import.meta.url), "utf8");

    await client.query("INSERT INTO cards(id,deck_id) VALUES(1,999)");
    await assert.rejects(client.query(sql), /Orphan cards found/);
    await client.query("ROLLBACK");
    assert.equal((await client.query("SELECT count(*)::int AS count FROM cards")).rows[0].count, 1);

    await client.query("DELETE FROM cards");
    await client.query("INSERT INTO decks(id) VALUES(1)");
    await client.query("INSERT INTO cards(id,deck_id) VALUES(2,1)");
    await client.query(sql);
    const fk = await client.query(
      "SELECT COUNT(*)::int AS count FROM pg_constraint WHERE conname='cards_deck_id_decks_id_fk' AND conrelid='cards'::regclass",
    );
    assert.equal(fk.rows[0].count, 1);
    const index = await client.query(
      "SELECT count(*)::int AS count FROM pg_indexes WHERE schemaname=$1 AND indexname='cards_deck_id_idx'",
      [schemaName],
    );
    assert.equal(index.rows[0].count, 1);

    // A failed write aborts the transaction: existing saved rows survive.
    await client.query("BEGIN");
    await client.query("INSERT INTO decks(id) VALUES(4)");
    await assert.rejects(
      client.query("INSERT INTO cards(id,deck_id) VALUES(3,77777)"), /foreign key/,
    );
    await client.query("ROLLBACK");
    assert.equal((await client.query("SELECT count(*)::int AS count FROM decks WHERE id=4")).rows[0].count, 0);
    assert.equal((await client.query("SELECT count(*)::int AS count FROM cards WHERE id=2")).rows[0].count, 1);

    // Deleting a deck removes only its cards under ON DELETE CASCADE.
    await client.query("DELETE FROM decks WHERE id=1");
    assert.equal((await client.query("SELECT count(*)::int AS count FROM cards")).rows[0].count, 0);
  } finally {
    await client.query("RESET search_path").catch(() => {});
    await client.query('DROP SCHEMA IF EXISTS "' + schemaName + '" CASCADE').catch(() => {});
    await client.end();
  }
});
