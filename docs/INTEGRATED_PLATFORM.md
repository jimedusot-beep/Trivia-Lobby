# Integrated implementation and operating limits

This branch preserves current main and merges the ancestry of Phase 1 PR #10, Phase 3 PR #15 and Phase 4 PR #11. The catalog from research PR #5 is included; main's richer 11-kind question schema remains authoritative. No third-party application source was copied.

| Requested work | Combined implementation |
|---|---|
| Accounts, authentication, deck/card authorization | One scrypt account, hashed random DB sessions, HttpOnly/SameSite cookies and logout; owner-filtered decks/cards; owner gate on every question, practice/check, backup and draft operation. Legacy ownerless decks stay inaccessible. |
| Reconnect credentials, room codes, validation, rate limits, safe outbound data | Collision-checked cryptographic codes; rotating hashed host/player credentials; socket binding; strict versioned incoming/outgoing schemas; 4 KB messages, bounded API/room/join/socket throttles, capacity limits and safe DTOs. Source passages and answer associations are absent from question events. Scores commit on reveal. |
| Multiplayer contracts, results, deadlines, transitions, complete match | Shared client/server protocol; lobby → playing → reveal → leaderboard → finished; server timers, duplicate/stale rejection, acknowledgment and snapshots. Real-socket test completes host/two-player match, reconnects and deadline rejection. |
| Transactional deletion, FKs, backups | Atomic owner-filtered deck deletion with FK cascades; transactional imports/reviews. Migrations validate references without deleting orphans. Restricted pg_dump archives/checksums and empty-target-only atomic pg_restore; CI restore rehearsal. Actual production backup scheduling is still required. |
| Original documents, secure storage, courses/folders/tags, content search | Signature-checked originals with SHA-256/size verification, owner deduplication/quota, private volume or encrypted S3 adapter; authorized download/delete; organization and PostgreSQL text search over extracted contents. |
| Idempotent import and tested JSON restoration | Account-scoped content receipts prevent identical imports/restores. V2 JSON preserves legacy cards, universal definitions/order, explanations, tags and source citations. Original media bytes and learning history have separate backup paths. |
| Universal questions, hotspots, matching, editing/reordering | Eleven graded model kinds; six editor kinds (MCQ, short answer, flashcard, true/false, matching, hotspot); legacy imported-card editing/reordering; click/keyboard hotspot answers; drag, touch-selection and menu matching. Live games accept legacy/universal single-choice questions with 2–4 choices. Other kinds remain solo. |
| Mastery/history, FSRS, cross-device progress | Per-user legacy-card and universal-question schedules; atomic idempotent histories; wrong-answer notebook, learning dashboard and private progress export. Default study uses persisted reviews; legacy practice also saves ratings with retry feedback. Flashcard preview is explicitly local. Self-rated recall is distinct from automatically graded questions. |
| Timed/untimed/adaptive practice, explanations/citations | Due/missed queues, weak-question prioritization and difficulty selection based on recent accuracy; local timed solo mode and untimed practice. Competitive deadlines are server enforced. Explanations and evidence appear after checking. |
| Unit, Playwright, PostgreSQL, audits and smoke | Unit and real-socket tests; PostgreSQL privacy, migration, FK, rollback and restoration tests; Chromium/Firefox/WebKit projects for visual authoring and host/player tests; phone overflow, keyboard controls, representative axe audits; HTTP/DB/WS smoke script; production dependency audit and generated license inventory. See the review record for actual local evidence; native PostgreSQL and the full browser matrix await integrated CI. |
| Branch reconciliation, feedback, mobile/a11y, autosave | Newer main preserved; account integration closes prototype ownership gaps; visible reconnect/server errors; labeled controls, reduced-motion styles and 44px regions; owner-scoped server drafts with optimistic revision conflicts. |
| PDF/DOCX generation, evidence approval, adaptive difficulty | PDF/DOCX/PPTX text extraction; linked private drafting source; optional HTTPS AI adapter; exact-substring evidence filtering, edit/approve and explicit idempotent publication. AI is disabled until configured; scanned PDFs require OCR/transcription. |
| Teams, original shops/upgrades, buzzer/wager/party | Host selects balanced teams, five-second buzzer turn, bounded virtual-point wagering, workshop Focus charge/Second wind, or every-third-round party multiplier. Server enforces purchases between rounds and scoring. No monetary transactions. |
| QTI/Anki, research reuse, provenance/licenses | QTI 2.1 single-choice/exact case-sensitive short-answer items and ZIP item packages; Anki two-column UTF-8 text import/export and basic two-field legacy APKG text import. Unsupported QTI processing and custom/cloze/media/new compressed APKG variants are explicitly rejected; originals retained. Research catalogs/source audits are preserved; no copyleft/restrictive application code copied. |

## Deployment and migration

Use Node 22+, HTTPS, a persistent PostgreSQL database and one long-running app process. `npm run db:migrate` bootstraps a fresh DB and repeats additive migrations safely. Back up existing DBs first. Do not use `db:push` for production reconciliation: it can propose destructive changes to objects beyond Drizzle's model.

The standalone Phase 4 prototype used separate `study_accounts`. If it was deployed, the migration refuses to guess identities. Map accounts/dependencies into `users` only after a backup and staging rehearsal. Legacy decks require verified manual ownership assignment. No old material is made public automatically.

Choose durable `PRIVATE_STORAGE_DIR` outside the application tree or `S3_BUCKET` plus workload credentials/region. S3 endpoints require HTTPS. Configure Block Public Access, least-privilege object permissions, versioning, encryption and independent retention. Provider changes require copying and hash-verifying objects; switching the environment does not migrate them. A provisioned S3 bucket has not been tested by this task.

## Backup and restore

Set `DATABASE_URL` and absolute encrypted durable `BACKUP_DIR`, then run `npm run backup:db`. Schedule it in the hosting provider/system scheduler, retain encrypted offsite copies, enable provider point-in-time recovery and monitor failures. Restore only into an empty isolated DB using `RESTORE_DATABASE_URL`, `BACKUP_FILE`, `ALLOW_EMPTY_RESTORE=yes` and `npm run restore:db`. The configured CI job rehearses native archive restoration, separate from JSON deck restoration; that job has not yet run for this branch.

**Committing a script does not enable production backups.** Original files need corresponding S3 version retention or volume snapshots; restore DB metadata and original bytes together and verify their hashes. No production deployment, database, bucket, AI key or backup schedule has been changed here.

## Optional AI adapter

`STUDY_AI_ENDPOINT` is server-only HTTPS (no redirects), with optional `STUDY_AI_API_KEY`. Request: `{task,limit,instructions,source:{title,text}}`. Response: `{cards:[{front,back,explanation?,evidence}]}`. Exact evidence must be in the source, suggestions are deduplicated, and an owner must edit/approve and explicitly publish into a private deck. Answers are limited to 500 characters. Evidence is reviewable support, not proof that every suggestion is true. No OCR is implemented.

## Verification limits

The [review record](INTEGRATION_REVIEW.md) records 51 passing unit/socket tests, five passing database/API tests using PGlite, five passing Chromium browser tests, type checking, build and smoke results. Native PostgreSQL 16, native archive restoration, Firefox and WebKit remain unverified here. Constituent PR results do not validate this combined branch.

Automated accessibility checks cover representative join/home flows, authoring alternatives and phone overflow; this is not a full WCAG conformance audit. Production dependency audit is clear at the current lockfile. Eight development build-tool advisories remain (five high, three moderate) in the Tailwind 3 selector/glob dependency chain; a forced Tailwind 4 migration was not applied. License metadata is an inventory; inspect the distributed license files before redistribution.

Rooms/reconnect credentials/WebSocket throttles are process-local. Restarting ends active matches; multiple replicas require shared authority and shared limits. Account recovery, MFA and malware scanning are additional product/deployment work.

## Original Imagegen asset

Built-in Imagegen generated `client/public/lobby-welcome.png` for this project. Prompt: “Use case: illustration-story. Asset type: original welcome artwork for Trivia Lobby, a study and classroom quiz web application. Create a polished warm editorial illustration of a small group of diverse adult students collaborating around study cards and a tablet at a round table, playful abstract quiz card shapes floating subtly behind them. Friendly accessible educational atmosphere, simple bold silhouettes and refined paper-like texture, clean wide composition suitable for a welcome card, rich deep purple with muted coral and warm cream accents. No text, letters, logos, proprietary characters, watermarks, or UI screenshot. Decorative illustration only, no factual diagrams. Landscape image.”
