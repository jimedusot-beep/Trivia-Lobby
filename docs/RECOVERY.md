# Encrypted database and original-file recovery

`script/backup.ts`, adapted from integration PR #20, creates an authenticated AES-256-GCM recovery archive containing a PostgreSQL snapshot, a file manifest and the exact retained original bytes. File sizes and SHA-256 hashes are verified before packaging. The recovery passphrase is derived with a random scrypt salt; every archive uses a fresh nonce. Keep the passphrase separately from the archive.

Set `DATABASE_URL`, the source `PRIVATE_STORAGE_DIR` or `S3_BUCKET` configuration, and a secret `BACKUP_PASSPHRASE` of at least 32 characters. Then create an archive in an existing private directory:

```sh
npm run backup:encrypted -- create /secure-backups/trivia.enc
```

`BACKUP_S3_BUCKET` optionally uploads the encrypted archive to a private offsite bucket. `.github/workflows/backups.yml` offers scheduled/manual backups only when the operator explicitly sets `BACKUPS_ENABLED=true` after configuring secrets, AWS access and retention. Merging this workflow does not enable backups. `infra/private-storage.yaml` supplies private versioned retained buckets and TLS-only policies; provisioning it is a separate operator action.

Restore into a new empty isolated database and a separate private storage destination. Set `RESTORE_DATABASE_URL`, `RESTORE_DISPOSABLE=1`, the recovery passphrase and the destination `PRIVATE_STORAGE_DIR` or S3 configuration:

```sh
npm run backup:encrypted -- restore /secure-backups/trivia.enc
```

The restore refuses the source database and a nonempty target, authenticates the archive before extraction, verifies original hashes, writes objects exclusively and restores the database in one transaction. Failed restores remove only newly written objects. Review the isolated result and application ownership/history before any promotion. Database metadata and original bytes must be restored together.

`npm run backup:drill` requires a disposable migrated native PostgreSQL test database with database-creation permission. It creates a fixture containing Unicode card content and a retained source, restores into independent targets, verifies the card contents, source metadata and exact original bytes, and cleans up the fixtures. CI runs this separately from JSON deck round-trips and the basic native archive rehearsal.

Production PITR, offsite retention, backup monitoring, restore rehearsals and recovery-key custody remain operator responsibilities. JSON deck exports remain useful portable content backups; they do not contain original media bytes or complete account histories.
