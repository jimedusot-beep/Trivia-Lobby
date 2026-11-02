# Production offsite recovery — owner runbook (Issue #48)

**Status:** Not verified for production. This document and the scheduled-job monitor do not create a remote backup, configure secrets, incur charges or restore production.

## Why this gate exists

The `Encrypted recovery backup` scheduled workflow previously reported overall `success` when `recovery-postgres18` passed its **disposable PostgreSQL fixture** and the actual production `backup` job was **skipped** because `BACKUPS_ENABLED` was not `true`. For example, November 1 run 41315192801: `recovery-postgres18=success`, `backup=skipped`. This cannot justify production recovery claims.

This change adds a schedule-only `scheduled-backup-audit` job that waits for both outcomes. A disabled, skipped, failed or cancelled offsite backup **must fail the scheduled workflow** and put a clear summary in GitHub Actions. It does **not** send independent missed-schedule alerts. A successful run proves a real encrypted destination upload/readback **job** succeeded, not that an entire restore was rehearsed.

## Secure operator sequence (owner authorization required)

1. **Select the destination.** Choose privately controlled, access-restricted, independent S3-compatible recovery storage after explicitly reviewing any prices, quotas, data retention and geographic/legal requirements. A second bucket with separate credentials is required. The existing application already supports S3-compatible offsite upload and SHA-256 readback. Avoid adding Restic/Kopia solely to fix a workflow-status defect. If evaluating either as an extra **external** backup layer later, verify it does not replace consistent pg_dump + original-file exports.
2. **Choose a recovery policy.** Record retention period, restoration target location, who can access/delete archives, object lifecycle and alerts; compare expected archive size against storage plan limits. Test destination read, write and cleanup using non-production fixtures. **Do not upload originals or production data to a test public bucket.**
3. **Configure secrets privately.** In GitHub Actions repository secrets (not files, commits, PR descriptions or chat), set `BACKUP_DATABASE_URL`, `BACKUP_PASSPHRASE` (32+ characters), `SOURCE_S3_BUCKET` and source credentials/endpoint if required, `BACKUP_S3_BUCKET` and separate destination credentials/endpoint. Refer to `.github/workflows/backups.yml` for the exact `SOURCE_AWS_*`, `BACKUP_AWS_*` and region/path-style names. Keep `BACKUPS_ENABLED` disabled during setup.
4. **Manually validate.** After approved credentials are ready, use GitHub Actions → **Encrypted recovery backup** → **Run workflow** on the reviewed branch. The manual backup job does not require the schedule variable. Confirm `recovery-postgres18=success` **and** `backup=success`; capture sanitized immutable destination object key, encrypted byte size and SHA-256. The backup code reads back the uploaded encrypted file and checks its bytes before reporting success. Ensure no credentials were echoed.
5. **Rehearse a real isolated restore.** Retrieve one real encrypted offsite archive through authorized private access. Restore it only to an **empty disposable PostgreSQL database and separate private-file storage**, using the guarded `backup.ts restore` path (`RESTORE_DISPOSABLE=1`, `RESTORE_DATABASE_URL`, `RESTORE_PRIVATE_STORAGE_DIR`). Ensure it cannot connect to production as a target. Independently compare SQL row counts, ownership/isolation checks and every original-file checksum. Record how long it took and any failure cases; remove temporary restored private data according to policy.
6. **Enable scheduled backup only after proof.** Set repository variable `BACKUPS_ENABLED=true`, allow the scheduled workflow to run, and verify **two consecutive scheduled jobs** completed the real `backup` job successfully. An all-green workflow is not enough without reviewing that job and the offsite archive. Keep a sanitized audit trail of source SHA, run ID, object locator, archive hash, restore evidence and retention.
7. **Add independent missed-run monitoring.** A scheduler that never fires produces no GitHub run to inspect. Connect an approved external heartbeat or scheduled monitoring channel with an alert if no fresh verified archive is produced inside the agreed time window. Avoid embedding secrets or archive contents in alert payloads.

## Failure handling

- **Scheduled guard fails because backups are disabled:** Expected and truthful. Keep issue #48 open. Complete owner storage/setup before enabling the schedule. Do not silence this signal by removing the guard.
- **Backup job fails:** Check its sanitized GitHub log, destination permissions and availability, source storage read, database version/connection and readback checks. Never expose passphrases/URLs in issues. A successful fixture drill is not a substitute.
- **Restore fails:** Do not deploy or point recovery to production. Keep the original encrypted archive, diagnose with disposable targets and verify no partial private-file data remain.
- **No scheduled workflow appeared:** Requires **external** missed-run monitoring. The in-workflow guard cannot detect a GitHub scheduler that never started.

## What counts as closing issue #48

- [ ] Owner-approved independent recovery provider, costs/retention and least-privilege credentials
- [ ] Real encrypted DB + original-file offsite archive, independently read back and hashed
- [ ] Isolated real offsite archive restore; DB rows and exact original-file bytes checked
- [ ] Two consecutive scheduled successful **production backup** jobs
- [ ] Alerting on backup failure **and missed schedules**
- [ ] Clear owner-approved retention, rotation, and recovery procedure

Current PR adds only the **failed/skipped scheduled-job detection** and its tests. Every unchecked production gate remains unresolved until separately verified.
