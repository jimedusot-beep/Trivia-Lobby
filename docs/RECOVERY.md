# Encrypted database and original-file recovery

`script/backup.ts`, adapted from integration PR #20, creates an authenticated AES-256-GCM recovery archive containing a PostgreSQL snapshot, a file manifest and the exact retained original bytes. File sizes and SHA-256 hashes are verified before packaging. The recovery passphrase is derived with a random scrypt salt; every archive uses a fresh nonce. Keep the passphrase separately from the archive.

Set `DATABASE_URL`, the source `PRIVATE_STORAGE_DIR` or `S3_BUCKET` configuration, and a secret `BACKUP_PASSPHRASE` of at least 32 characters. Then create an archive in an existing private directory:

```sh
npm run backup:encrypted -- create /secure-backups/trivia.enc
```

`BACKUP_S3_BUCKET` optionally uploads the encrypted archive to an independent private bucket using **separate** `BACKUP_AWS_ACCESS_KEY_ID` and `BACKUP_AWS_SECRET_ACCESS_KEY` credentials, with optional `BACKUP_AWS_SESSION_TOKEN`. Set `BACKUP_AWS_REGION` (default `us-east-1`); for a non-AWS provider, set an HTTPS `BACKUP_S3_ENDPOINT` and, if needed, `BACKUP_S3_FORCE_PATH_STYLE=true`. Source `AWS_ENDPOINT_URL_S3`, `AWS_REGION` and `AWS_*` credentials never configure the destination. Neon is rejected as an offsite destination. Use a different provider or account and keep recovery-key custody separate from the archive.

The upload uses a unique object key and refuses overwrites. It then downloads the **actual encrypted bytes** and checks length and SHA-256. Success logs the recovery object key, size and digest; retain that receipt. A successful PUT alone is insufficient. Failed readback leaves any remote object for investigation; it does not report a successful backup.

`.github/workflows/backups.yml` allows explicit manual bootstrap runs; daily runs require the operator to set `BACKUPS_ENABLED=true` after configuring secrets, access, retention and proving recovery. Its PostgreSQL 18 container matches the live Neon PostgreSQL 18 source; PostgreSQL 16 `pg_dump` cannot export an 18 server. The scheduled job sets `BACKUP_REQUIRE_OFFSITE=1`: missing offsite configuration fails before database export rather than creating an ephemeral archive and deleting the only copy. Merging the workflow does not enable backups. `infra/private-storage.yaml` supplies private versioned retained buckets and TLS-only policies; provisioning is a separate operator action and is not authorized to incur charges.

Configure these GitHub Actions values privately. The connected GitHub application does not expose repository secret or variable writes.

| Purpose | Repository secrets | Repository variables |
| --- | --- | --- |
| Consistent database export | `BACKUP_DATABASE_URL` (direct/unpooled PostgreSQL URL) | — |
| Archive encryption | `BACKUP_PASSPHRASE` (at least 32 characters; retain separately in a password manager) | — |
| Source originals (Neon) | `SOURCE_S3_BUCKET` = `uploads`, `SOURCE_S3_ENDPOINT`, `SOURCE_AWS_ACCESS_KEY_ID`, `SOURCE_AWS_SECRET_ACCESS_KEY`; optional `SOURCE_AWS_SESSION_TOKEN` | `SOURCE_AWS_REGION` = `us-east-2`; `SOURCE_S3_FORCE_PATH_STYLE` = `true` |
| Independent offsite recovery | `BACKUP_S3_BUCKET`, `BACKUP_AWS_ACCESS_KEY_ID`, `BACKUP_AWS_SECRET_ACCESS_KEY`; optional `BACKUP_S3_ENDPOINT`, `BACKUP_AWS_SESSION_TOKEN` | `BACKUP_AWS_REGION`; optional `BACKUP_S3_FORCE_PATH_STYLE` |
| Enable only after successful manual backup and restore | — | `BACKUPS_ENABLED` = `true` |

For bootstrap, leave `BACKUPS_ENABLED` unset, dispatch the workflow manually, download its verified offsite object, and restore that downloaded object into isolated storage and PostgreSQL 18. Enable the daily schedule only after that recovery passes. Retain at least seven daily versions and confirm the provider's free allowance before provisioning. Grant the backup writer PUT/GET on its prefix; reserve deletion and retention changes for separate credentials. A zero-file production database still requires a nonempty-file recovery fixture to prove original-byte recovery.

Restore into a new empty isolated database and a separate private storage destination. Set `RESTORE_DATABASE_URL`, `RESTORE_DISPOSABLE=1`, the recovery passphrase and **`RESTORE_PRIVATE_STORAGE_DIR`**, an existing empty absolute directory outside the application tree and separate from source storage. The automatic restore always writes locally with create-only file semantics. It strips inherited source S3 endpoints/credentials before reading or writing objects, so loading production Neon settings cannot redirect a restore to production uploads. Direct S3 restores are not supported by this safe rehearsal path; verify locally before separately transferring recovered bytes to a new isolated bucket.

```sh
npm run backup:encrypted -- restore /secure-backups/trivia.enc
```

The restore refuses the source database and a nonempty target, authenticates the archive before extraction, verifies original hashes, writes objects exclusively and restores the database in one transaction. Failed restores remove only newly written objects. Review the isolated result and application ownership/history before any promotion. Database metadata and original bytes must be restored together.

`npm run backup:drill` requires a disposable migrated native PostgreSQL test database with database-creation permission. It creates a fixture containing Unicode card content and a retained source, restores into independent targets, verifies the card contents, source metadata and exact original bytes, and cleans up the fixtures. CI runs this separately from JSON deck round-trips and the basic native archive rehearsal, including a secret-free PostgreSQL 18 job using the same client container as the scheduled backup. Production backups depend on that fixture job; PR events never run the job holding production secrets.

Production PITR, offsite retention, backup monitoring, restore rehearsals and recovery-key custody remain operator responsibilities. JSON deck exports remain useful portable content backups; they do not contain original media bytes or complete account histories.
