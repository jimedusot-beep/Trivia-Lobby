# Free Trivia Lobby website — Render + Neon, no Replit

**Status (October 24, 2026): LIVE FREE PREVIEW at [trivia-lobby.onrender.com](https://trivia-lobby.onrender.com).** The existing Render **Free** web service is connected to the existing Neon **Free** production database and private `uploads` bucket. The app's startup verified private uploads, applied all 8 migrations and initialized 19 public-schema tables. A public GitHub-hosted smoke test passed HTTP, database readiness and secure WebSockets. This is not a production SLA or a guarantee of future $0 usage.

**Do not store irreplaceable or sensitive student records in the free preview until you have independently verified backups and data-retention controls.** Any existing Replit/development data must be backed up and deliberately migrated; creating a new Neon database does not copy it.

## What you get, and what is free

| Component | Provider and plan | Purpose |
| --- | --- | --- |
| Public website and WebSockets | Render **Free**, 0.1 CPU / 512 MB, one instance | HTTPS, host/play screens, live room PINs and QR, API |
| Persistent relational data | Neon **Free** Postgres (currently up to 1 GB/project) | Accounts, quiz decks, past reports, assignments |
| Original uploaded files | Neon **Free** private S3-compatible Object Storage (currently up to 5 GB/project) | Durable file bytes; **not** Render's temporary filesystem |
| Custom domain | Optional | Use the free `*.onrender.com` address first |
| AI generation | Disabled/unconfigured | A commercial AI API is **not** necessary for core quizzes |

Neon Free currently includes 100 CU-hours of compute/project/month, 1 GB database storage, and 5 GB object storage, subject to Neon limits and future changes. Render Free has a 750-hour workspace allowance per month and usage/bandwidth limits. **To stay at $0, watch the dashboard's free limits and avoid enabling pay-as-you-go overage billing; an account with an active payment method can be billed for bandwidth overages.** If you can't enforce a $0 spend limit, avoid attaching a payment method and check Render's current billing settings before creating the service. **Don't provision Render Free Postgres:** it expires after 30 days and cannot retain data indefinitely.

Sources:
- https://render.com/docs/free
- https://neon.com/blog/neon-free-plan-1-gb-per-project
- https://neon.com/docs/storage/get-started

## Important free-tier limitations

- After **15 minutes without incoming HTTP or WebSocket traffic**, Render Free sleeps. Waking it can take **about a minute**. A new game host should open the site before players arrive.
- Render Free can restart the server; **an active live game then ends**. Completed reports and self-paced attempts persist in Neon.
- Render Free has **no durable disk**. Files stored in the Render container disappear. The app uses **private Neon Object Storage** instead.
- Remote Postgres/S3 traffic and heavy memory/CPU can hit free-tier limits. Large PDFs, sustained classrooms, 100 simultaneous *real* users and guaranteed uptime are **not promised**.
- The free tier does not give a comprehensive independent offsite backup solution. Export and restore test before using meaningful data.

## Existing live instance — do this instead of reprovisioning

**To use Trivia Lobby:** open [the live site](https://trivia-lobby.onrender.com), register your first private account and make a small practice deck. To inspect or redeploy, open its [existing Render service dashboard](https://dashboard.render.com/web/srv-dbecn2nb9u1s7398u8j0). Do **not** create another Render Blueprint, Neon project or storage bucket for this installation. Auto-deploy is intentionally off, so reviewed future GitHub merges need a deliberate deployment.

If any current project (including unpublished Replit workspaces) contains saved decks or original documents, **do not delete it**. Export/backup and verify it before deciding to start an empty database.

## Existing Neon backend — already connected

**Already configured:** production Postgres uses pooled `DATABASE_URL` for normal queries and direct `DATABASE_URL_UNPOOLED` for migrations; the storage bucket is private `uploads`, with an S3 credential scoped to read/write access. Paid Neon AI Gateway inference is explicitly disabled. Never copy database passwords or storage secrets into GitHub source or screenshots. The [Neon CLI guide](NEON_CLI_SETUP.md) is for rebuilding this configuration deliberately, not an additional step needed to use the site.

The manual steps below are an alternative only when you do **not** already have a Neon project.

## New installations only — manual Neon Console setup (alternative)

1. Open [Neon Console](https://console.neon.tech) and create a **Free** project, for example `trivia-lobby`, using a region supporting Neon Object Storage (e.g. AWS US East N. Virginia or Ohio). Select the free plan—not a trial with a paid upgrade.
2. From **Connect**, obtain both PostgreSQL URLs with TLS (`sslmode=require`): the **pooled** URI for `DATABASE_URL` and the **direct, not transaction-pooled** URI for `DATABASE_URL_UNPOOLED`. The migration runner uses a PostgreSQL advisory lock and requires the direct connection.
3. Open the Neon **Storage** view and create a bucket named `uploads` with **private** access. Never set it to public-read.
4. From **Storage → Connect**, select the **S3** connection parameters and obtain:
   - S3 endpoint URL (`AWS_ENDPOINT_URL_S3` in Neon's UI)
   - `AWS_REGION`
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - Bucket name (`uploads`, if you chose that name)
5. Keep credentials private: do **not** paste them into GitHub, frontend `VITE_*` variables, source code, screenshots, issues or public chat. Neon's credentials are server-only.

Neon reference: https://neon.com/docs/storage/get-started

## New installations only — create a Render website

Only for a separate, new installation, open the [Deploy to Render](https://render.com/deploy?repo=https://github.com/jimedusot-beep/Trivia-Lobby) shortcut, or choose **New → Blueprint** from [Render Dashboard](https://dashboard.render.com) and connect GitHub repo `jimedusot-beep/Trivia-Lobby`.

**Check the pricing screen before confirmation:** the Blueprint must list only **one `trivia-lobby` web service on plan Free**—no Render database, disk, worker or paid service.

Render prompts for **six values** during initial setup:

| Render environment variable | Copy from Neon |
| --- | --- |
| `DATABASE_URL` | Pooled Postgres URI from Neon CLI (`sslmode=require`) |
| `DATABASE_URL_UNPOOLED` | Direct Postgres URI from Neon CLI; used for advisory locks/migrations/backups |
| `AWS_ENDPOINT_URL_S3` | Neon S3-compatible endpoint (same variable name CLI supplies) |
| `AWS_REGION` | Neon Storage region |
| `AWS_ACCESS_KEY_ID` | Branch-scoped Neon Storage S3 credential ID |
| `AWS_SECRET_ACCESS_KEY` | Branch-scoped Neon Storage S3 credential secret |

The private `uploads` bucket is declared in `neon.ts`; the app automatically detects Neon path-style S3. The Blueprint also sets `S3_FORCE_PATH_STYLE=true`, `NODE_ENV=production`, `PORT=10000` and `NODE_VERSION=22.22.0`; no disk path needs entering. Keep `autoDeployTrigger=off` initially.

**Do not approve** if the dashboard shows a paid Render service, a storage disk, or a Postgres database. You do not need a card-based Cloudflare R2 subscription for this path.

## Verify the existing public website

Your existing site URL is **https://trivia-lobby.onrender.com**. The application launches only when it can:

1. Write, read back, SHA-256-verify and delete a random test object from the `neon.ts` private Neon bucket.
2. Apply the versioned PostgreSQL migrations.
3. Start Express + WebSockets and serve the frontend.

Check `https://trivia-lobby.onrender.com/health/live` and `https://trivia-lobby.onrender.com/health/ready` (both must return HTTP 200). In GitHub Actions, the **Public deployment smoke** manual workflow can test the actual HTTPS host with the existing `npm run smoke` command.

Then test on your iPhone and another browser: register an account, create a quiz, host and join a live room by PIN and QR, finish and reopen a report, publish and complete a guest assignment, and upload/download a **disposable** test document. Restart the service and check those completed records and file bytes remain accessible. Active games need to be restarted after a service restart.

## Security, backups and next upgrade

- Authenticated API routes are still responsible for access to private decks and files; an S3 bucket is never published.
- PostgreSQL and storage credentials belong **only** in Render's server-side environment settings.
- Neon recovery windows are limited on the Free plan, and Neon object storage is not an independent offsite backup. Create a verified encrypted export of **both** the database and original files to a separate controlled location before storing meaningful records. The existing GitHub backup workflow is disabled by default.
- Test on a real iPhone, Android and home Wi-Fi. Local 100-player load tests are *not* a free-tier capacity guarantee.
- Upgrade later by changing the Render web plan and/or the Neon plan. The application and GitHub repository can remain the same; no Replit migration is required.
- Use a single web instance unless real-time room authority is redesigned. Current active WebSocket rooms are process-local.

See also [production startup](PRODUCTION_STARTUP.md), [disaster recovery](RECOVERY.md) and [release gate](RELEASE_VERIFICATION_2026_10_24.md).
