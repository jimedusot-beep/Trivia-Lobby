# Family night readiness implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task by task.

**Goal:** Verify the live family-game release and repair the existing backup path without adding games or paid resources.

**Architecture:** Keep the existing AES-256-GCM archive, PostgreSQL snapshot, and original-file hash verification. Separate source-object credentials from offsite-destination credentials, fail scheduled runs when offsite configuration is incomplete, and use a PostgreSQL 18 client for the PostgreSQL 18 source.

**Tech stack:** Node.js 22, TypeScript, AWS SDK v3, PostgreSQL 18, GitHub Actions, Render Free, Neon Free.

**Spec:** The owner's October 26 request: protect main with passing checks and one independent approval; configure encrypted offsite backups and isolated recovery; verify Render; test QR, joining, reconnects, scoring and leaderboards with 10–20 actual phones.

## Global constraints

- Free plans only; no paid resources or AI Gateway.
- No new games or major features.
- No unreviewed merge or deployment.
- Never print or commit credentials, recovery keys, player tokens, or private records.
- Simulated clients and browser tests do not establish actual-phone acceptance.

## Review focus

- A Neon source endpoint must not redirect offsite writes back into Neon.
- An enabled scheduled backup must fail when its destination is absent.
- Partial destination credentials must fail before production reads.
- A successful upload must be read back and match the encrypted archive digest.
- The live release can change independently during this audit; re-check its commit.

### Task 1: Correct the existing backup path

**Files:** `script/backup.ts`, `script/backup-config.ts`, `server/backup-config.test.ts`, `.github/workflows/backups.yml`, `package.json`, `.env.example`, `docs/RECOVERY.md`.

- [ ] Reproduce configuration failures with tests: missing required offsite bucket, partial credentials, source-endpoint leakage, non-HTTPS destination, source/destination reuse, and corrupted upload readback.
- [ ] Run those tests and confirm the failures.
- [ ] Add explicit destination configuration, safe preflight, and readback integrity verification; keep local archive creation available.
- [ ] Run targeted tests, type check, existing unit tests, native encrypted restore drill and production build.
- [ ] Open a reviewed PR; leave actual account configuration and promotion blocked if the required credentials/access are unavailable.

### Task 2: Verify release and record remaining operator work

**Files:** `docs/FAMILY_NIGHT_READINESS_2026_10_26.md`, `docs/REPOSITORY_CLEANUP_2026_10_25.md`, `script/github-main-protection.json`.

- [ ] Record exact Render workspace, service, current live commit, health, errors and automated acceptance.
- [ ] Prepare a protection payload using actual passing job names and one independent approval, with no bypasses.
- [ ] Verify existing 10/20-client acceptance; run bounded live guest checks and browser QR/join/reconnect checks.
- [ ] Add an actual-phone checklist with observable pass/fail criteria and explicit untested status.
- [ ] Report concrete access/key/destination blockers; never represent a manual Neon snapshot as offsite recovery.

## Review and execution evidence

- Review found an inherited Important restore-isolation hazard: inherited Neon settings could overwrite the source. Added `server/restore-storage.ts`, two RED-to-GREEN regressions, an extended native drill and a secret-free PostgreSQL 18 CI job. Automatic restoration now uses an explicit empty local directory, with all source S3 settings removed.
- Code and operator instructions are proposed in PR #63. Main protection, real offsite configuration/recovery and actual phones remain blocked/pending as recorded in the readiness report. No merge or deployment is authorized until those gates pass.
