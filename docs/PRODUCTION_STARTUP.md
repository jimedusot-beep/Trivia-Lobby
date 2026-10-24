# Production startup (Render recommended)

**Preferred public hosting:** [Render, without Replit](RENDER_DEPLOYMENT.md). It provisions one Node web service, paid PostgreSQL and an attached private persistent disk through `render.yaml`. The Replit section below is retained only for operators who still have existing development data there; publishing Replit is not required for Trivia Lobby.

Use a maintained Node.js 22 or newer release, PostgreSQL, HTTPS and **one** continuously running app process. Live rooms and socket limits reside in memory; changing the deployment or restarting the process ends active matches. Do not enable multiple replicas until room authority and throttles have shared storage.

## Build and launch

```sh
npm ci
npm run check
npm run build
# Optional for a separate runtime install after building:
npm prune --omit=dev
# Supply deployment secrets before running:
npm start
```

The deployable artifact is `dist/` plus `package.json`, the lockfile and installed production npm dependencies. Source TypeScript, `tsx`, Vite and the source SQL directory are not required at runtime. `npm start` runs `dist/start.mjs`, which validates configuration, verifies an actual private write/read/delete, applies the versioned packaged SQL migrations under a database advisory lock, validates foreign keys, then starts the HTTP/WebSocket server. Nothing listens until these checks finish. Repeated startup preserves existing content and repeats migrations safely.

Back up any existing database and originals before upgrading, and rehearse with a staging copy first. Automatic startup does not resolve orphaned legacy records or guess account ownership. Pre-account decks need verified ownership assignment; the separate experimental Phase 4 identities require explicit reconciliation. Migrations stop on these issues.

Required production secrets/settings:

| Setting | Value |
|---|---|
| `DATABASE_URL` | Persistent production PostgreSQL URL supplied by the database provider. Keep provider-required TLS enabled. |
| `PORT` | Hosting-assigned listening port, default `5000`. |
| Private originals | Set `S3_BUCKET` with AWS region and server-side workload credentials, or absolute `PRIVATE_STORAGE_DIR` on a provisioned durable private volume outside the app tree. Never use deployment scratch storage for originals. |
| Optional S3 endpoint | `S3_ENDPOINT` must use HTTPS without credentials in its URL. The existing adapter requires compatible encryption/checksum/conditional-write behavior. |

Use the hosting secret manager, never frontend `VITE_` settings, for database, object-storage, AI and backup credentials. The startup storage probe checks access and exact bytes; it does not establish durability, retention or bucket privacy policy. Those must be provisioned independently. If both storage settings exist, S3 takes precedence.

Startup errors identify the failing stage and, when safe, a provider error code without logging connection strings or raw provider exceptions. Check environment names, private storage permissions, database connectivity and the migration requirements above. Database connection acquisition is bounded to 10 seconds; application queries to 15 seconds. Migration lock acquisition waits at most 30 seconds and individual migration statements at most 120 seconds.

## Legacy Replit project (not required for current deployment)

The repository points to [Trivia-Lobby on Replit](https://replit.com/@jimedusot/Trivia-Lobby). Replit access is required to inspect and publish that existing project; a GitHub merge does not prove a production deployment occurred.

1. Pull the merged `main` source into that project. The checked-in `.replit` selects `nodejs-22`, builds with `npm run build`, and runs `node ./dist/start.mjs`.
2. In Publishing → Adjust settings, select **Reserved VM**, one instance, web-server mode. Replit documents [deployment types](https://docs.replit.com/features/publishing/deployment-types) and [build/run configuration](https://docs.replit.com/features/project-setup/configuration). The checked-in commands do not configure paid resources or provision storage.
3. Set the production PostgreSQL and private object-storage secrets. Replit's workspace files and a deployment are separate environments; do not treat a local directory in the project as durable production object storage. The current adapter supports a private S3-compatible service; Replit App Storage would need its own adapter.
4. Provision independent encrypted offsite backups/retention and database recovery before storing valuable study materials. See [RECOVERY.md](RECOVERY.md) and `infra/private-storage.yaml`.
5. Publish, then check the actual HTTPS URL, including sign-up/sign-in, a source upload/download, host/player match, reconnect and a restart. Production cookies are Secure/HttpOnly/SameSite; HTTPS is required for normal public browser use.

Run HTTP, database and actual socket smoke checks against the returned production URL:

```sh
SMOKE_URL=https://your-actual-deployment.example npm run smoke
```

`/health/live` reports a running process. `/health/ready` returns 200 when the account schema can be queried, or 503 when the database is unavailable. Storage was verified before startup; readiness is not a continuous object-store or backup monitor. Missing `/api/*` routes and `/assets/*` files return 404 instead of the SPA document.

## Automated production acceptance

`npm run test:production` requires `PRODUCTION_TEST_DATABASE_URL` pointing to a separate **empty disposable** database, different from `DATABASE_URL`. It refuses a populated database. The test does not erase existing data; use a new test database for each run.

CI builds, removes all development dependencies, copies only deployment artifacts into an isolated directory and boots them against native PostgreSQL 16. The test checks fail-closed configuration without leaking a sentinel credential, migration of a fresh DB, compiled client assets and API errors, Secure session cookies, private text/PDF uploads and PDF worker extraction, exact originals and sessions after restart, and a complete scored host/player game over real WebSockets. The HTTP test sends cookies explicitly to inspect the server contract; the public HTTPS deployment still needs its own live browser smoke check.
