import { defineConfig } from "@neon/config/v1";

/**
 * Trivia Lobby's branch-scoped Neon backend. PostgreSQL is implicit: every
 * Neon project includes it. Object Storage is deliberately private.
 *
 * AI Gateway is paid-only as of October 2026. For the owner's $0 preview,
 * leave ENABLE_PAID_NEON_AI_GATEWAY unset. To opt into paid gateway later,
 * first confirm billing/credits, then explicitly set that flag before
 * neon config plan / neon deploy.
 */
export default defineConfig({
  buckets: {
    "trivia-originals": { access: "private" },
  },
  ...(process.env.ENABLE_PAID_NEON_AI_GATEWAY === "true"
    ? { aiGateway: true as const }
    : {}),
});
