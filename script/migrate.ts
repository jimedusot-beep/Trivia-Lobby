import { readFile } from "node:fs/promises";
import { Pool } from "pg";

if(!process.env.DATABASE_URL)throw new Error("DATABASE_URL required");
const pool=new Pool({connectionString:process.env.DATABASE_URL});
const client=await pool.connect();
try {
  await client.query("SELECT pg_advisory_lock(8675309)");
  // Every migration is additive and independently transactional. Stop on the first error.
  for(const name of ["0000_legacy_base.sql","0001_private_library.sql","0001_universal_questions.sql","0004_phase4_study.sql","0005_integrated_platform.sql"]){
    await client.query(await readFile(new URL("../migrations/"+name,import.meta.url),"utf8"));
    console.log("Applied "+name);
  }
  await client.query("ALTER TABLE cards VALIDATE CONSTRAINT cards_deck_id_decks_id_fk");
  await client.query("ALTER TABLE decks VALIDATE CONSTRAINT decks_owner_id_users_id_fk");
} finally {
  await client.query("SELECT pg_advisory_unlock(8675309)").catch(()=>{});client.release();await pool.end();
}
