import { applyMigrations } from "./migrations";

if(!process.env.DATABASE_URL)throw new Error("DATABASE_URL required");
await applyMigrations(process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL, new URL("../migrations/", import.meta.url));
