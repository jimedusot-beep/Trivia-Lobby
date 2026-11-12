# Zero-spend backup preflight — PR A

**Status:** Safety guard only; production backups are not enabled.

## Safety behavior

- Manual workflow dispatch defaults to **dry-run**. This runs the existing disposable PostgreSQL recovery drill and the offline policy check, but never reaches the live backup job.
- Selecting **production** and typing the explicit confirmation is **not sufficient** to authorize a live backup. The preflight evaluates approval flags, conservative capacity, retention, download estimates and recovery status, but **always rejects real uploads in PR A** with LIVE_UPLOAD_DISABLED.
- Scheduled runs retain the fail-closed audit. When the real backup is skipped or denied, the scheduled workflow must fail rather than report disposable recovery as a successful production backup.
- Pull requests never enter the production backup job or receive its secrets. Existing synthetic recovery validation remains unchanged.

## Why live uploads are deliberately disabled

An operator-provided numeric budget and boolean approval flags do not establish a guaranteed $0 cloud bill. The existing production backup combines archive creation and upload, so it does not enforce the final archive size before transfer. Account-wide storage, provider caps, download allowances and lifecycle behavior are not independently verified.

The preflight does not contact a database, bucket, provider or other network resource. Its theoretical storage projection is:

    current_used_bytes + archive_max_bytes * (retention_days + expiry_buffer_days)

It also checks a projected monthly download amount against an approved download budget. These validations **do not** authorize a live upload. Live uploads require a separate reviewed change and explicit owner approval after bounded execution and enforceable provider-side financial safeguards are verified.

## Fail-closed conditions

Stop if there is an attempted access to production records, B2 endpoints, real source files, or backup secrets from the preflight or test mode; a skipped real backup is hidden behind a green audit; financial exposure is unknown; existing regression tests are weakened; or implementation requires repository setting, billing, provider account or deployment changes.

Do not set any repository approval variables or production secrets as part of PR A. Do not run manual production mode to attempt a backup. Keep issue #48 open until a real offsite encrypted archive and isolated restore are independently proven.

## Verification and evidence

Offline focused checks under Node 22:

    node --test tests/backup-preflight.test.mjs tests/backup-workflow-policy.test.mjs

Existing backup monitor and heartbeat tests must also remain green. Existing encryption/offsite tests, npm test, npm run check, and the disposable PostgreSQL recovery drill require a complete local checkout and dependencies; report any unavailable tests as **not executed**, never as passing.

Record the base SHA, exact PR head SHA, changed filenames, test counts, failing-first evidence, observed CI run IDs and any blockers. The preflight uses no production secret values and prints only fixed reason codes.

No B2 account, bucket, subscription, secret, billing change, production backup, or deployment is part of this PR.
