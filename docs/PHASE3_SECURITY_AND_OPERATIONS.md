# Phase 3 — private library, security, imports and recovery

This document describes the **Phase 3 implementation in draft PR #15**, not a deployed release. Phase 1 multiplayer hardening and Phase 2 visual authoring are independent work.

## Implemented foundation

- Account registration, login and logout with salted scrypt password hashing, hashed random session tokens stored in PostgreSQL, seven-day expiry and HttpOnly + SameSite=Lax cookies (Secure in production).
- Server-side ownership checks for all deck/card HTTP routes, game room creation and file actions. A guest may join a public multiplayer room without gaining access to the host's private deck APIs.
- Private original bytes stored outside the app/public directories in a durable operator-managed filesystem volume; PostgreSQL metadata includes owner, SHA-256, filename, inferred MIME, byte count, storage key, status, folder, tags and created timestamp. Internal storage keys are never returned to clients.
- Per-file 8 MiB and per-account 100 MiB limits, per-owner duplicate hashes, hash verification on download, server-authorized attachment retrieval and original source deletion.
- Owner-reviewed source preview and explicit approval before creating a linked deck; transactional deck/card/source-link writes.
- Searchable original filenames, folder/course labels and tags.

## Formats — do not advertise unsupported conversion

| Input | Original bytes retained | Suggested cards |
| --- | --- | --- |
| CSV, TSV | Yes | Existing validated front/back/multiple-choice parser (2 MiB preview, up to 5,000 cards) |
| Trivia Lobby JSON v1 | Yes | Existing versioned deck backup restore |
| TXT, Markdown | Yes | Lines formatted as question TAB answer, question :: answer or question => answer |
| DOCX, PPTX | Yes | Only question/answer pairs present in extracted document/slide XML |
| PDF | Yes | None — manually authored cards only |
| Anki APKG | Yes | None — no Anki DB parser |
| QTI | Yes | None — no QTI interoperability yet |
| H5P | Yes | None — no H5P interoperability yet |

DOCX/PPTX extracted text does not preserve reliable page/slide evidence, formatting, embedded diagrams or media. TXT/Markdown line hints appear during preview but are not permanent scholarly citations. No generative AI runs on private sources in this phase. All suggestions require an explicit approval click.

## Database upgrade

Back up the current production PostgreSQL database before migration. Deploy and install dependencies, then run:

    npm ci
    npm run db:migrate:phase3

For a completely fresh database only, run npm run db:push first. Avoid schema-push on production with live data without reviewing its generated statements. The SQL migration is additive and repeatable.

Old records are not assigned to accounts automatically. Legacy decks retain NULL owner_id and will not appear in any signed-in library. An operator who can independently verify ownership can review and selectively assign them:

    SELECT id, title, owner_id FROM decks WHERE owner_id IS NULL;
    SELECT id, email FROM users WHERE email = 'verified@example.com';
    UPDATE decks SET owner_id = 'verified-user-uuid'
      WHERE id = 123 AND owner_id IS NULL;

Never mass-assign these decks. The new cards-to-decks FK is initially NOT VALID to avoid deleting or rejecting preexisting orphan data; it enforces integrity on new writes. After a supervised orphan audit, validate it with ALTER TABLE cards VALIDATE CONSTRAINT cards_deck_id_decks_id_fk.

## Private disk configuration

Set DATABASE_URL to a persistent PostgreSQL instance and PRIVATE_STORAGE_DIR to an **absolute path outside the project tree** on a protected persistent volume. Example: /srv/trivia-private (created and owned by the app service user, permission 0700). Use HTTPS, NODE_ENV=production and trusted ingress limits. Do not serve this path statically or put it in a web root, Git repository, build artifact or temporary deploy directory.

The code intentionally refuses writes if storage is not configured correctly. This is a **single-host/shared-volume object backend**, not S3 or signed-CDN-URL storage. For multiple app instances, provision a shared protected volume or add a real audited object-store adapter. No antivirus or quarantine engine is bundled. The ZIP guard validates metadata for malicious paths, encryption and high compression ratios, but it does not prove files malware-free; do not inline-execute untrusted PDFs or office documents. Downloads use attachment, nosniff, sandbox and no-store headers.

## Backup and recovery runbook — operator must perform a staging drill

1. Stop new writes. Record deployment commit, migration version, database snapshot time and private-volume snapshot ID.
2. Back up PostgreSQL with pg_dump --format=custom --file=trivia.dump $DATABASE_URL and take a coordinated backup/snapshot of the entire private original-file volume. Encrypt backup copies and enforce least-privilege access.
3. Restore both artifacts into isolated staging using pg_restore and the matching file snapshot. Never test destructive restore against the active production instance.
4. Verify file metadata rows against SHA-256 hashes of stored bytes; test an authorized original download, a linked deck's cards and JSON/CSV deck export.
5. Verify a second account cannot read the restored file/deck by ID. Sign in from a fresh session and verify the owner can still read them.
6. Record RPO/RTO and any DB-row/blob discrepancies. Reconcile missing source blobs and unreferenced orphan blobs before declaring a successful recovery.

The application writes private bytes before metadata insertion to avoid a successful DB row pointing to a failed write, then cleans up on caught failures. A process crash can leave an orphan blob. Deletion removes DB metadata then tries to unlink a blob; a crash can likewise leave an orphan. No automated orphan reconciliation is implemented.

**Actual restore/PITR tests have not been run on staging**. CI confirms a clean PostgreSQL migration and a live API integration test only, not the backup/recovery drill above.

## Retention, privacy and remaining risks

Owners can retrieve original bytes and export card decks separately in CSV or Trivia Lobby JSON; there is no single portable whole-account archive. Deleting an original source does not delete its derived deck; deleting a deck cascades to its cards and removes its file links. Deleted private source bytes can remain in snapshots or backups according to operator-defined retention; a final production policy must specify the retention period and deletion SLA before using real student records.

Password resets, verified email, MFA, account erasure/export, per-card version history, permanent page/section citations, S3 versioning, malware scanning, shared distributed rate limits, truly serialized concurrent quotas, and universal APKG/QTI/H5P/PDF conversion remain outside this implementation. Existing Phase 1 reconnect credential and game-answer exposure issues remain and are not claimed fixed. Dependency auditing on the Node 22 CI installation reported 26 advisories (2 low, 3 moderate, 20 high, 1 critical); review direct/transitive dependencies before production use.

## Verification evidence

GitHub Actions run 39683888664 on commit b10d01e verified:
- TypeScript check, production build.
- 19 unit tests, 19 passing.
- Fresh PostgreSQL schema and additive Phase 3 migration.
- One HTTP integration scenario passing: two users, no anonymous private access, cross-user 404 boundaries, CSRF Origin reject, duplicate original rejection, invalid PDF rejection, explicit linked deck approval, exact byte download, logout and new session, deletion of source while keeping deck.
- **Not tested:** live browser accessibility, backup recovery, synchronized multi-device deployment and complete third-party import compatibility.

## Third-party research and provenance

No reference repository source or branding was copied. A repository metadata check in October 2026 confirmed the presence of independently developed sources below. Licensing metadata is a starting point, not permission to copy unknown snippets.

| Repository | Classification | GitHub license metadata | Status |
| --- | --- | --- | --- |
| ankitects/anki | Official open-source Anki implementation | NOASSERTION | Anki format reference only |
| quenti-io/quenti | Independent study-platform source | AGPL-3.0 | Reference only |
| JohnGrahn/LibreStudy | Independent study-platform source | No license confirmed in metadata | Reference only |
| lfnovo/open-notebook | Independent notebook/AI source | MIT | Reference only |
| ecamodeo/qti-builder | Independent QTI tooling | No license confirmed in metadata | Reference only |
| learningequality/kolibri | Official Kolibri project source | MIT | Reference only |
| jarjk/crablit | Independent study-platform source | MIT | Archived, reference only |
| YibinLong/Memochi | Independent flashcard source | MIT | Reference only |

Before reusing any source, inspect its individual LICENSE, copyright notices, exact pinned commit, dependencies, API tests and compatibility; the current PR uses none.
