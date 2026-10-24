import { readFile } from "node:fs/promises";
import { Pool } from "pg";

export async function applyMigrations(databaseUrl: string, directory: URL) {
  const pool = new Pool({ connectionString: databaseUrl, connectionTimeoutMillis: 10_000 });
  try {
    const client = await pool.connect();
    try {
      await client.query("SET lock_timeout = '30s'");
      await client.query("SET statement_timeout = '120s'");
      await client.query("SELECT pg_advisory_lock(8675309)");
      // Each migration is additive, independently transactional and safe to repeat.
      for (const name of ["0000_legacy_base.sql", "0001_private_library.sql", "0001_universal_questions.sql", "0004_phase4_study.sql", "0005_integrated_platform.sql", "0006_persistent_learning_history.sql", "0007_live_game_reports.sql", "0008_self_paced_assignments.sql"]) {
        await client.query(await readFile(new URL(name, directory), "utf8"));
        console.log("Applied " + name);
      }
      await client.query("ALTER TABLE cards VALIDATE CONSTRAINT cards_deck_id_decks_id_fk");
      await client.query("ALTER TABLE decks VALIDATE CONSTRAINT decks_owner_id_users_id_fk");
    } finally {
      // A failed statement can leave a migration transaction aborted.
      await client.query("ROLLBACK").catch(() => {});
      await client.query("SELECT pg_advisory_unlock(8675309)").catch(() => {});
      client.release();
    }
  } finally {
    await pool.end();
  }
}
