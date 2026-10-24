import { validateProductionConfig, verifyPrivateStorage } from "../server/production-config";
import { verifyNeonAiGateway } from "../server/neon-ai-gateway";

/**
 * Read-only database test and ephemeral private-object round trip.
 * Never print connection strings, storage credentials or bearer tokens.
 */
async function main() {
  validateProductionConfig();
  const { pool } = await import("../server/db");
  try {
    const ping = await pool.query("SELECT current_database() AS database, current_user AS username, 1 AS ok");
    if (ping.rows[0]?.ok !== 1) throw new Error("PostgreSQL did not respond");
    console.log("PostgreSQL: connected (pg Pool + Drizzle)");

    const schema = await pool.query(
      "SELECT to_regclass('public.users') AS users, to_regclass('public.quiz_assignments') AS assignments",
    );
    if (!schema.rows[0]?.users || !schema.rows[0]?.assignments) {
      console.log("PostgreSQL schema: incomplete; run npm run db:migrate with the direct URL");
      process.exitCode = 1;
    } else {
      console.log("PostgreSQL schema: user/assignment tables present");
    }
  } finally { await pool.end(); }

  await verifyPrivateStorage();
  console.log("Neon Object Storage: PUT/GET/SHA-256 compare/DELETE succeeded (temporary random private key)");

  const gateway = await verifyNeonAiGateway();
  console.log(gateway === "disabled"
    ? "Neon AI Gateway: disabled (free-tier setting; no model calls or charges)"
    : "Neon AI Gateway: authenticated /v1/models request succeeded (inference not run)");
  if (process.exitCode) throw new Error("Verification failed: database migration is incomplete");
  console.log("Neon service verification: PASS");
}
main().catch(() => {
  // Provider exceptions can leak connection strings and credentials.
  console.error("Neon service verification: FAIL (check env, branch and provider logs)");
  process.exitCode = 1;
});
