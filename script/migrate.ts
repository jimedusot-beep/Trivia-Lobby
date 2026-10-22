import { readFile } from "node:fs/promises";
import pg from "pg";
const client=new pg.Client({connectionString:process.env.DATABASE_URL});
const files=["phase1_cards_fk.sql","0001_private_library.sql","0001_universal_questions.sql","0004_phase4_study.sql","0005_integrated_platform.sql","0006_question_memory.sql"];
try {
  if(!process.env.DATABASE_URL)throw new Error("DATABASE_URL required");
  await client.connect();
  await client.query("SELECT pg_advisory_lock(784152630)");
  for(const file of files){await client.query(await readFile(new URL("../migrations/"+file,import.meta.url),"utf8"));console.log("Applied "+file);}
  await client.query("ALTER TABLE cards VALIDATE CONSTRAINT cards_deck_id_decks_id_fk");
  await client.query("ALTER TABLE decks VALIDATE CONSTRAINT decks_owner_id_users_id_fk");
} finally {await client.end();}
