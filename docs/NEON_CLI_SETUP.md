# Neon backend setup — Trivia Lobby

**Current status:** The existing production Neon branch, PostgreSQL and private `uploads` bucket are **already connected** to [the live free Render website](https://trivia-lobby.onrender.com). This is a reconstruction/developer guide; do **not** rerun `neon init` or `neon deploy` simply to use the app, since doing so may change existing resources. Paid AI Gateway inference remains disabled.

This repository already uses **Express, a persistent Node.js server, node-postgres Pool and Drizzle**, an app-owned account system, plus private S3-compatible file uploads. Keep those; Neon supplies a branch-scoped Postgres database, private Object Storage, and an optional AI Gateway. The web frontend and game WebSocket server are still hosted separately on Render Free; Neon is the **backend**, not the website host.

## Project selected by owner

- Organization: the existing Neon organization selected by the owner (keep the ID private)
- Neon project: the existing project selected by the owner (keep the ID private)
- Neon branch: `production`
- Database: PostgreSQL (already included in Neon projects)
- Storage: private bucket `uploads`, declared in `neon.ts`.
- AI Gateway: **requires a paid Neon plan with credits**. This app's earlier requirement is **$0**, so the gateway is opt-in only. Running an unmodified init/deploy including `ai-gateway` on Free will fail provisioning. The app's other services work without it.

Never commit `.neon`, `.env`, `.env.local`, API keys or connection strings to GitHub. Do not post them in issues, logs or chat. Check whether the named Neon production branch already contains important data before any schema changes.

## On a computer or terminal that has internet and can open your browser

From your **cloned Trivia-Lobby repository root**, with Node.js **22.20+** (needed by Neon's skill installer):

```bash
npm i -g neon@latest
# If npm's global install is blocked on your machine, prefix commands with:
# npx neon@latest
neon --version
neon login
```

**Complete the Neon browser sign-in** if the CLI opens one. If it times out, run `neon login` again. The CLI must be authorized for your own organization and project.

**Free-plan-compatible setup**, preserving the tracked `neon.ts` (do not replace with a CLI-generated paid-gateway config):

```bash
neon init -y --org-id <your-org-id> --project-id <your-project-id> --branch production --services postgres,object-storage
neon config plan
neon deploy
neon env pull --service postgres --service object-storage --file .env.local
```

`neon init` links this directory and installs Neon agent tooling. If the branch does not exist, inspect the Neon dashboard or use the CLI branch creation command deliberately; do not create a new project or move valuable existing data. `neon config plan` is the dry-run; **review it** before applying. `neon deploy` provisions the private `uploads` bucket on your selected branch, then pulls Neon-managed environment variables into `.env.local` (or `.env` if one already exists). You can force a fresh `.env.local` using the `neon env pull --file` command shown above. Don't commit either file.

Neon provides:

| Neon variable (server-only) | Used for |
| --- | --- |
| `DATABASE_URL` | Pooled application queries from the existing `pg.Pool` / Drizzle |
| `DATABASE_URL_UNPOOLED` | Direct schema migration, PostgreSQL advisory locks and database backups |
| `AWS_ENDPOINT_URL_S3` | Branch-specific HTTPS S3-compatible object endpoint |
| `AWS_REGION` | Bucket region |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | Scoped private object-storage credentials |
| `NEON_BRANCH` | Branch identity/status (not a password) |

The source code now recognizes `AWS_ENDPOINT_URL_S3` directly. The bucket name comes from `neon.ts`; no duplicate manual S3 endpoint/bucket vars are necessary for Neon CLI users. The S3 client applies path-style addressing automatically. Files are uploaded privately and read back to verify the SHA-256 before the app accepts them.

## Build, migrate, verify, run

```bash
npm ci
npm run check
npm run build
# App migrations take an advisory lock and require the *unpooled* connection:
node --env-file=.env.local --import tsx script/migrate.ts
# Actual SQL SELECT + private ephemeral upload/read/hash/delete; no model tokens:
npm run verify:neon
npm run start:neon
```

Use a **second terminal** to check the running website API, e.g.:

```bash
SMOKE_URL=http://127.0.0.1:5000 npm run smoke
```

Successful expected messages include: `PostgreSQL: connected`, `PostgreSQL schema: user/assignment tables present`, `Neon Object Storage: PUT/GET/SHA-256 compare/DELETE succeeded`, and `Neon service verification: PASS`. **These are success conditions, not claims that they have run against your actual account yet.** The built production launcher also tests storage and migrations before accepting connections.

If `neon init` writes a pre-existing `.env` instead, continue with the explicit `neon env pull --file .env.local` command above; running the Neon npm scripts requires `.env.local`.

**Do not run the destructive or full backup-restore integration suite against your selected production Neon branch.** Existing CI uses its own disposable PostgreSQL database; only the live, temporary upload and read-only query verification script is safe for production data.

## Optional paid AI Gateway (not part of the $0 version)

The exact all-services command requested is:

```bash
neon init -y --org-id <your-org-id> --project-id <your-project-id> --branch production --services postgres,ai-gateway,object-storage
```

Neon does **not** let you provision AI Gateway on Free. Do **not** run this all-services provisioning command or enable model billing merely to make the Free version deploy. If you later choose a paid plan with prepaid AI credits, first confirm your account's allowed models and costs. Only after explicit approval:

```bash
ENABLE_PAID_NEON_AI_GATEWAY=true neon config plan
ENABLE_PAID_NEON_AI_GATEWAY=true neon deploy
```

Neon will then issue `NEON_AI_GATEWAY_BASE_URL` and `NEON_AI_GATEWAY_TOKEN`. Choose an enabled model and store its exact ID as the server-only `NEON_AI_GATEWAY_MODEL` value. Set `ENABLE_PAID_NEON_AI_GATEWAY=true` **only on the server**. The app routes its existing review-required, source-grounded study-card generator through the gateway using an HTTPS-only, bounded JSON adapter. Existing source-evidence verification and owner authorization remain active. No gateway credentials are exposed to the browser. `npm run verify:neon` checks `/v1/models` without inference cost when enabled; that is **not** proof that a paid model generation succeeded. A real inference smoke requires a separately approved paid test.

Neon official AI documentation: https://neon.com/docs/ai-gateway/prepaid-credits

## Render Free deployment (actual public website)

After Neon has been verified, open the connected Render dashboard. Render's GitHub `render.yaml` prompts for six **server-only** values: `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `AWS_ENDPOINT_URL_S3`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`. Add them in Render's private environment UI rather than a GitHub file. `NODE_ENV`, `PORT`, and single-instance WebSocket architecture remain configured by `render.yaml`.

The public website doesn't materialize from `neon deploy`; it still needs its separate Render Free web-service deployment. Render Free sleeps when idle and can interrupt active live games. Stored quizzes, assignment attempts, reports and private original files persist in Neon after server restarts, subject to provider free-tier limits.

## If this fails

- **`npm i -g neon@latest` or `npx neon@latest` fails on DNS:** use an internet-connected machine/terminal and retry. No CLI command can authenticate while npm packages cannot be downloaded.
- **CLI opens a browser:** finish Neon sign-in there. If the browser flow expires: `neon login`, then repeat `neon init` or `neon deploy`.
- **AI Gateway deploy says upgrade needed:** leave `ENABLE_PAID_NEON_AI_GATEWAY` unset and deploy only Postgres + Object Storage.
- **No bucket or credentials:** confirm `neon config status`, private `uploads` bucket, `neon env pull --service object-storage --file .env.local`. Do not paste real AWS credentials into the terminal history or support messages.
- **SQL migration hangs/fails:** verify `DATABASE_URL_UNPOOLED` points to the same intended Neon branch but does **not** include `-pooler`. Back up existing records before retrying migrations.
- **`npm run verify:neon` reports failure:** run locally and inspect provider logs, without sharing connection secrets. Do not declare a successful setup until it passes.
- **Render web service fails:** ensure both connection strings and AWS env fields are present, S3 bucket is private, and run the public HTTP/WebSocket smoke after its HTTPS address is assigned.

Neon references: [CLI](https://neon.com/docs/cli/overview), [neon.ts](https://neon.com/docs/reference/config-as-code), [Object Storage](https://neon.com/docs/storage/get-started), [Postgres pooled vs direct](https://neon.com/docs/connect/connection-pooling).

## Execution status in this ChatGPT environment

The CLI commands were attempted, but both `npm i -g neon@latest` and the `npx neon@latest` fallback returned `EAI_AGAIN` (cannot resolve `registry.npmjs.org`). A Git clone also failed to resolve `github.com` in the local shell. Account CLI authentication, `neon init`, `neon deploy`, local `.env.local` pull, and **actual service end-to-end tests** therefore have **not** been performed here. GitHub Actions can test the code against mock data and disposable Postgres; that is not Neon account provisioning.
