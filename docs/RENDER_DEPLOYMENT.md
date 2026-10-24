# Free Trivia Lobby website — Render + Neon, no Replit

**Status:** This is a $0 **preview configuration**, not a published website or a production SLA. It provisions **one free Render Node web service**. A free Neon project provides PostgreSQL and private S3-compatible object storage. No paid web service, Render database, or persistent disk is provisioned by `render.yaml`.

**Do not store irreplaceable or sensitive student records in the free preview until you have independently verified backups and data-retention controls.** Any existing Replit/development data must be backed up and deliberately migrated; creating a new Neon database does not copy it.

## What you get, and what is free

| Component | Provider and plan | Purpose |
| --- | --- | --- |
| Public website and WebSockets | Render **Free**, 0.1 CPU / 512 MB, one instance | HTTPS, host/play screens, live room PINs and QR, API |
| Persistent relational data | Neon **Free** Postgres (currently up to 1 GB/project) | Accounts, quiz decks, past reports, assignments |
| Original uploaded files | Neon **Free** private S3-compatible Object Storage (currently up to 5 GB/project) | Durable file bytes; **not** Render's temporary filesystem |
| Custom domain | Optional | Use the free `*.onrender.com` address first |
| AI generation | Disabled/unconfigured | A commercial AI API is **not** necessary for core quizzes |

Neon Free currently includes 100 CU-hours of compute/project/month, 1 GB database storage, and 5 GB object storage, subject to Neon limits and future changes. Render Free has a 750-hour workspace allowance per month and usage/bandwidth limits. **Don't provision Render Free Postgres:** it expires after 30 days and cannot retain data indefinitely.

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

## Step 1 — finish the release PRs

Review and merge [#36 — security and migrations](https://github.com/jimedusot-beep/Trivia-Lobby/pull/36) **before** [#37 — free hosting](https://github.com/jimedusot-beep/Trivia-Lobby/pull/37), and make sure the final commit passes CI. Don't deploy the vulnerable older `main` branch.

If any current project (including unpublished Replit workspaces) contains saved decks or original documents, **do not delete it**. Export/backup and verify it before deciding to start an empty database.

## Step 2 — create a free Neon backend (one account)

1. Open [Neon Console](https://console.neon.tech) and create a **Free** project, for example `trivia-lobby`, using a region supporting Neon Object Storage (e.g. AWS US East N. Virginia or Ohio). Select the free plan—not a trial with a paid upgrade.
2. From the **Connect** view, obtain your project's **direct (not transaction-pooled)** PostgreSQL connection URI including TLS (`sslmode=require`). The app's migration runner uses a PostgreSQL advisory lock and should not use transaction-pooled PgBouncer. Save the URI privately for `DATABASE_URL`.
3. Open the Neon **Storage** view and create a bucket named `trivia-originals` with **private** access. Never set it to public-read.
4. From **Storage → Connect**, select the **S3** connection parameters and obtain:
   - S3 endpoint URL (`AWS_ENDPOINT_URL_S3` in Neon's UI)
   - `AWS_REGION`
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - Bucket name (`trivia-originals`, if you chose that name)
5. Keep credentials private: do **not** paste them into GitHub, frontend `VITE_*` variables, source code, screenshots, issues or public chat. Neon's credentials are server-only.

Neon reference: https://neon.com/docs/storage/get-started

## Step 3 — connect the free Render website

After **both PRs are merged**, open the [Deploy to Render](https://render.com/deploy?repo=https://github.com/jimedusot-beep/Trivia-Lobby) shortcut, or choose **New → Blueprint** from [Render Dashboard](https://dashboard.render.com) and connect GitHub repo `jimedusot-beep/Trivia-Lobby`.

**Check the pricing screen before confirmation:** the Blueprint must list only **one `trivia-lobby` web service on plan Free**—no Render database, disk, worker or paid service.

Render prompts for **six values** during initial setup:

| Render environment variable | Copy from Neon |
| --- | --- |
| `DATABASE_URL` | Direct Postgres URI, with TLS enabled |
| `S3_BUCKET` | Private bucket name, e.g. `trivia-originals` |
| `S3_ENDPOINT` | Neon `AWS_ENDPOINT_URL_S3` full HTTPS endpoint |
| `AWS_REGION` | Neon Storage region, e.g. `us-east-1` |
| `AWS_ACCESS_KEY_ID` | Neon Storage S3 credential ID |
| `AWS_SECRET_ACCESS_KEY` | Neon Storage S3 credential secret |

The Blueprint already sets `S3_FORCE_PATH_STYLE=true`, `NODE_ENV=production`, `PORT=10000` and `NODE_VERSION=22.22.0`; no disk path needs entering. Keep `autoDeployTrigger=off` initially.

**Do not approve** if the dashboard shows a paid Render service, a storage disk, or a Postgres database. You do not need a card-based Cloudflare R2 subscription for this path.

## Step 4 — verify your real URL

Render will assign your site an actual `https://….onrender.com` address. That exact URL is unknown until you deploy. The application launches only when it can:

1. Write, read back, SHA-256-verify and delete a random test object from private Neon storage.
2. Apply the versioned PostgreSQL migrations.
3. Start Express + WebSockets and serve the frontend.

Check `https://YOUR-ACTUAL-ADDRESS.onrender.com/health/live` and `/health/ready` (both must return HTTP 200). In GitHub Actions, the **Public deployment smoke** manual workflow can test the actual HTTPS host with the existing `npm run smoke` command.

Then test on your iPhone and another browser: register an account, create a quiz, host and join a live room by PIN and QR, finish and reopen a report, publish and complete a guest assignment, and upload/download a **disposable** test document. Restart the service and check those completed records and file bytes remain accessible. Active games need to be restarted after a service restart.

## Security, backups and next upgrade

- Authenticated API routes are still responsible for access to private decks and files; an S3 bucket is never published.
- PostgreSQL and storage credentials belong **only** in Render's server-side environment settings.
- Neon recovery windows are limited on the Free plan, and Neon object storage is not an independent offsite backup. Create a verified encrypted export of **both** the database and original files to a separate controlled location before storing meaningful records. The existing GitHub backup workflow is disabled by default.
- Test on a real iPhone, Android and home Wi-Fi. Local 100-player load tests are *not* a free-tier capacity guarantee.
- Upgrade later by changing the Render web plan and/or the Neon plan. The application and GitHub repository can remain the same; no Replit migration is required.
- Use a single web instance unless real-time room authority is redesigned. Current active WebSocket rooms are process-local.

See also [production startup](PRODUCTION_STARTUP.md), [disaster recovery](RECOVERY.md) and [release gate](RELEASE_VERIFICATION_2026_10_24.md).
