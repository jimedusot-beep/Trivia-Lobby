import { applyMigrations } from "./migrations";
import { validateProductionConfig, verifyPrivateStorage } from "../server/production-config";

// This entry point is built as dist/start.mjs alongside SQL and the application.
// No TypeScript loader or development dependencies are needed in production.
process.env.NODE_ENV = "production";
let stage = "configuration";
try {
  validateProductionConfig();
  stage = "private storage";
  await verifyPrivateStorage();
  console.log("Private storage verified");
  stage = "database migration";
  await applyMigrations(process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL!, new URL("./migrations/", import.meta.url));
  stage = "application";
  await import(new URL("./index.cjs", import.meta.url).href);
} catch (error) {
  // Provider errors can contain connection strings or credentials. Only config
  // errors above are controlled messages; never print raw provider exceptions.
  const code = typeof error === "object" && error !== null && "code" in error && typeof error.code === "string" && /^[A-Z0-9_]{1,20}$/.test(error.code) ? ` [${error.code}]` : "";
  console.error(`Startup failed during ${stage}${code}${stage === "configuration" && error instanceof Error ? ": " + error.message : ""}`);
  process.exit(1);
}
