# Trivia Lobby release gate — October 24, 2026

Status: **candidate only; not merged or deployed**. This document defines observable acceptance criteria. Green GitHub CI is *necessary*, but not evidence that a public production endpoint is configured.

## Changes being verified

- Dependency fix: `zod@4.6.7`, `zod-validation-error@4.0.2`, `drizzle-zod@0.8.3` and `body-parser@2.4.0`, captured in an npm-resolved lockfile. Do not suppress or bypass `npm audit`.
- Disable compressed request-body decompression for JSON and URL-encoded forms. Verified by a real compiled-server test using gzip requests.
- Retained-learning migration `0006_persistent_learning_history.sql` and associated historical attempt snapshots, integrated after `0005` and **before** already-merged `0007_live_game_reports.sql` and `0008_self_paced_assignments.sql`.
- Shared TypeScript and Zod API compatibility, including intentionally omitted `response` on skipped study questions.

## CI acceptance and evidence

`CI` must pass clean `npm ci`, TypeScript, unit tests, production build and full `npm audit --audit-level=moderate`. Its lockfile is committed; install cannot rewrite versions.

`Integrated platform acceptance` must pass:
1. **Fresh PostgreSQL 16** migration to 0008, then repeated migration without breaking existing data.
2. **Existing-database upgrade rehearsal:** `script/rehearse-release-migrations.ts` starts with 0005 + 0007 + 0008 (simulating the previously shipped state), seeds historical card and visual attempts plus report and assignment snapshots, applies all migrations including 0006 twice, deletes the original deck and verifies all expected historical and published records remain intact. The rehearsal uses a separate disposable PostgreSQL database from the compiled-production test.
3. Production build stripped of development dependencies, boot of compiled artifacts, owner login/deck/file persistence, service restart, versioned host/player WebSocket game, saved game report and owner-only access, guest self-paced attempt resume/submit/results, and rejection of compressed request bodies.
4. Owner-scoped PostgreSQL integration tests, recovery export/restore with actual `pg_dump`/`pg_restore`, encrypted database and original-document recovery, and Chromium/Firefox/WebKit Playwright tests.
5. Local single-instance WebSocket load scenario covering 10, 25, 50 and 100 simulated participants (no network latency or production SLA claims).

**Store final workflow URLs / commit SHA here only after GitHub confirms completed results.** A pending or cancelled run is not a pass.

## Required operator actions before any public deployment

1. Schedule downtime or a maintenance window with the actual host and back up the production PostgreSQL database and all original private source files to an independently accessible offsite destination.
2. **Restore backups into isolated staging** and rehearse the migrations against an actual copy of existing data. Compare row counts for `study_events`, `question_attempts`, `live_game_sessions`, `quiz_assignments` and their child rows before/after. Verify retained snapshots after deleting only disposable staging material.
3. Verify real HTTPS domain, cookie/SameSite/secure settings, production environment variables, private S3/object-storage permissions or durable private volume, error alerting, and deployment rollback procedures.
4. Smoke-test a host and several real mobile devices joining via room code, link and QR; finish a mixed-format live quiz, close/reopen the browser, inspect the report, and finish a guest assignment after another server restart.
5. Do a restore rehearsal after deployment. The SQL migrations are additive but may be irreversible for downgrade purposes: do **not** silently run an old application against new tables or assume a database snapshot can be reconstructed from application logs.
6. Release only after a human review of account privacy, existing live answer-key protections, CSV exports and guest assignment sharing. Public content discovery, collaboration and multi-instance live-room persistence are outside this release.

## Known deliberate limits

- Real-time room state still lives in a single Node.js process. A server restart interrupts any live match; only completed reports and async assignment attempts are durable.
- Synthetic load tests share one host and loopback networking. They do not prove a 100-player classroom SLA over real Wi-Fi.
- Nicknames on public guest assignments are not verified identities; attempt limits do not make the feature suitable for proctored exams.
- Source-file recovery depends on real private object-storage/volume backups. GitHub Actions' disposable storage is not production recovery.
- PR #26 is superseded by the integrated migration/code on this candidate branch but should not be closed until its behavior is accepted and the replacement is merged.
