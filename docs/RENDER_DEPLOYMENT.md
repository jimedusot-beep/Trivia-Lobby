# Deploy Trivia Lobby on Render (no Replit)

**Status:** This is a deployment template, not evidence of an existing public installation. Publishing creates **paid resources**. Review costs and verify any previously saved data *before* creating databases or moving accounts.

## What you get

A single internet-accessible website (HTTPS `https://<service>.onrender.com`) containing React frontend, Express API, and WebSocket multiplayer; one Render-managed PostgreSQL 16 instance and one persistent private disk for uploaded originals. Render supplies HTTPS certificates and manages the web URL; no custom domain is required.

`render.yaml` is a one-click Render Blueprint connected to this GitHub repository. **It uses a paid 512 MB web process + paid 256 MB Postgres and a 2 GB persistent disk**, one instance in Virginia. Charges start when resources are provisioned, even if no students visit. Refer to Render's current [pricing](https://render.com/pricing) before accepting the estimate; additional bandwidth, databases, backup storage, and upgrades may cost extra.

**Deliberate safeguards:** `autoDeployTrigger: off` so a push cannot surprise-upgrade your active database, `numInstances: 1` to match the current in-memory live-game architecture, private-only database IP access, and storage mounted outside the source/build tree. No paid resources, secrets, user records or deployment are created by merely merging this file.

## Step 1 — finish code review and data preservation

1. Merge security/migration release PR **#36** only after its existing automated evidence is reviewed: `https://github.com/jimedusot-beep/Trivia-Lobby/pull/36`. This deployment blueprint branch **depends on #36**, and should be merged afterward. Do not deploy an older vulnerable `main`.
2. Verify whether any existing development installation (including prior hosting accounts) holds user-generated decks or source uploads. If it does, **back up and verify those before migration**; don't silently switch the database and leave the old data behind.
3. If there are no valuable records, use a *new empty* Render PostgreSQL database. This is a clean installation rather than a production-data upgrade.

## Step 2 — connect Render to GitHub

1. Sign into [Render Dashboard](https://dashboard.render.com). Use **New → Blueprint**, authorize GitHub access to `jimedusot-beep/Trivia-Lobby`, and select this repository's **main** branch containing `render.yaml`.
2. Review the services and charges **before** authorizing creation. Expected: `trivia-lobby` web service, `trivia-lobby-db` PostgreSQL, and `trivia-private-originals` disk. Confirm all are located in **Virginia** and only **one** web instance is configured.
3. The Blueprint wires `DATABASE_URL` automatically via Render's private network; **do not** paste database credentials into GitHub, code, frontend `VITE_*` variables or public URLs.
4. Confirm `PRIVATE_STORAGE_DIR=/var/data/trivia-originals` on a disk mounted at `/var/data`. Never replace that with a folder inside the GitHub checkout or Render's ephemeral filesystem. Nothing beyond the disk mount is persistent.
5. Create the Blueprint after reviewing the paid plan. This initial action may start a first deployment even though *subsequent* Git auto-deploys are disabled.
6. Read the build/runtime logs. `npm ci && npm run build` creates production artifacts; `npm start` verifies storage, applies repeatable migrations, then binds the HTTP/WebSocket server to `PORT=10000`. `/health/ready` must return HTTP 200.
7. Render assigns a HTTPS address such as `https://<actual-service>.onrender.com`. **Do not invent or hardcode this address before Render provides it.**

## Step 3 — protect data *before* using with real students

Render-managed Postgres includes provider recovery options on paid plans, and paid persistent disks have encrypted daily snapshots. These **do not replace independent offsite recovery** and cannot be assumed sufficient for saved classroom documents.

1. Confirm managed PostgreSQL point-in-time recovery, disk snapshots, account MFA, and correct storage permissions in Render Dashboard.
2. Set up an **independent encrypted offsite archive** of the database **and** original file bytes, using `script/backup.ts` or a verified equivalent. The existing GitHub Actions backup workflow is disabled by default (`BACKUPS_ENABLED` must be explicitly enabled), and this Blueprint's Postgres `ipAllowList: []` deliberately blocks unapproved external GitHub runners. **Do not enable the GitHub backup workflow while relying on private-only DB access; it will not be able to connect.** Use a securely configured in-region backup runner or a tightly scoped secure connection, then test it.
3. Restore a backup into an **empty isolated staging database and private storage location**; compare row counts and uploaded-file hashes. Confirm the backup passphrase is stored separately from the archive.
4. Until this is finished, treat the site as an **evaluation instance**, not a safe repository for irreplaceable data.

## Step 4 — run the published-site checks

From a trusted terminal with the repository installed, use the actual Render URL:

```sh
SMOKE_URL=https://YOUR-REAL-RENDER-DOMAIN npm run smoke
```

Or in GitHub Actions, use the manual **Public deployment smoke** workflow and paste the actual HTTPS URL. It checks `/health/live`, `/health/ready`, and WebSocket connectivity; it does not log in or alter user data.

Then personally verify in real mobile browsers:

- Register and sign in over HTTPS (Secure + HttpOnly session cookies).
- Create an original quiz, host it, join from another phone with its PIN, direct link and QR image.
- Finish a mixed-format round, reopen the reports page, and download its owner-only CSV.
- Publish a self-paced assignment, submit once as a guest, reopen on the same device, and review results as the host.
- Upload a disposable test document, download **identical** bytes after an app redeploy; verify no other account can access it.
- Restart the app *between* completed sessions and verify accounts, reports, assignments and source files remain. Active live games **will stop on restart** because room state is process-local.
- Test screen-reader/navigation behavior and responses over real home/classroom Wi-Fi before claiming a classroom capacity.

## Operations / troubleshooting

- **No data after redeploy?** Verify Render's disk remains attached at `/var/data` and database wasn't recreated. Do not continue storing files until independently recovered.
- **Startup failed during configuration?** Check paid database is available; both resources must use the Virginia region, `DATABASE_URL` must refer to the database, and `/var/data` must be mounted as persistent storage.
- **Slow/unstable hosting or build out-of-memory?** A 512 MB web service is a cost-conscious starting plan, not proven sufficient for high traffic, long PDFs, or 100 *real* learners. Upgrade to 2 GB after observing memory and latency.
- **Migrations:** The application migrates at startup under a DB advisory lock. Any restore or schema upgrade involving existing records must have verified backup, isolated rehearsal and owner approval beforehand.
- **Backup and rollback:** Redeploying old binaries does **not** undo SQL migrations. An old version might not understand the new schema. Keep source, database and original documents together in restore plans.
- **WebSockets:** One service instance only. A persistent Render disk disables zero-downtime deploys, which interrupt active live games. Schedule maintenance around live sessions.
- **Source of truth:** GitHub is the code repository; Render is the public hosting/dashboard. Replit is not a deployment dependency.

## Verified provider references

- [Render Blueprint YAML](https://render.com/docs/blueprint-spec)
- [Render Node/Express deployments](https://render.com/docs/deploy-node-express-app)
- [Render persistent disk limitations](https://render.com/docs/disks)
- [Render Postgres and private networking](https://render.com/docs/postgresql-creating-connecting)
- [Render pricing](https://render.com/pricing)
- [Project recovery runbook](RECOVERY.md)
- [Release verification](RELEASE_VERIFICATION_2026_10_24.md)
