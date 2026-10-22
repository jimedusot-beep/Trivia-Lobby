# Trivia Lobby

Private study materials, visual exams, saved learning progress and live classroom games in one TypeScript/React/Express/PostgreSQL application.

This branch integrates current main with secure multiplayer, private source storage and the FSRS study engine. The [review and verification record](docs/INTEGRATION_REVIEW.md), [item-by-item checklist](docs/IMPLEMENTATION_CHECKLIST.md) and [operating runbook](docs/INTEGRATED_PLATFORM.md) distinguish implemented features from remaining validation and deployment configuration. Historical phase reports describe their original branches.

## Start

Use Node 22+, persistent PostgreSQL and a private durable source volume or private S3 bucket. The Tailwind 4 UI supports Safari 16.4+, Chrome 111+ and Firefox 128+; see the [build-tool migration](docs/BUILD_TOOL_MIGRATION.md). See `.env.example`; never commit credentials.

```sh
npm ci
export DATABASE_URL='postgresql://...'
export PRIVATE_STORAGE_DIR='/srv/trivia-originals'
npm run db:migrate
npm run dev
```

Back up existing databases before migration. Pre-account decks require verified ownership assignment. Previously deployed experimental Phase 4 identities need explicit migration. Use checked-in migrations in production, not `db:push`.

## Features

- One account for private decks, documents, drafts and learning history; guests can join live rooms.
- Retained originals, course/folder/tag organization, extracted-content search, reviewed imports and source-linked drafting.
- MCQ, short-answer, flashcard, true/false, matching and hotspot authoring with editing, reordering and server autosave. Eleven graded model kinds. Imported legacy cards also support editing and reordering.
- Visual practice with saved attempts, FSRS schedules, timed/untimed/adaptive modes, explanations and citations.
- Due reviews, wrong-answer notebook, course/subject statistics, cross-device persistence and progress export.
- Server-authoritative live quiz state, rotating reconnect credentials and deadlines. Classic, teams, buzzer, virtual-point wagers, original workshop upgrades and party rounds.
- V2 JSON backups preserve legacy cards and visual definitions/order/citations. Anki text and supported QTI item export; supported QTI and basic legacy APKG text import.

Live games currently support 2–4-choice MCQs from either question schema. QTI conversion covers QTI 2.1 single-choice and exact, case-sensitive short-answer items, individually or in ZIP item packages. Anki conversion covers two-column text and basic two-field legacy APKG text notes. Custom/cloze/media/new compressed APKG formats remain retained originals and need a supported export. JSON is the lossless complex-question format; original media bytes and histories have separate backup paths. Scanned PDFs need OCR/transcription. AI stays disabled until a provider is configured, and requires explicit review/approval/publication.

## Verification

```sh
npm run check
npm test
npm run build
npm audit --audit-level=moderate
npm run audit:licenses
# Isolated disposable PostgreSQL only, after migration:
TEST_DATABASE_URL="$DATABASE_URL" STUDY_TEST_DATABASE_URL="$DATABASE_URL" npm run test:integration
# After building, with a running test app and browser runtimes:
npx playwright install chromium firefox webkit
npm run test:e2e
npm run smoke
```

The integrated GitHub Actions workflow covers migration repetition, account isolation, PostgreSQL FK/rollback tests, JSON and native database restoration, socket matches, production build, full dependency audit and compiled-style regressions, HTTP/DB/WS smoke and three browser engines. See [merged main acceptance](https://github.com/jimedusot-beep/Trivia-Lobby/actions/runs/39814795907) for recorded hosted results and the [review](docs/INTEGRATION_REVIEW.md) for recorded evidence and limits.

## Operations and research

Use one long-running app process behind HTTPS. Rooms and WebSocket throttles are process-local. Provision persistent storage and database backups before using valuable materials. Backup/restore tools are included; actual production scheduling, encrypted offsite retention, S3 configuration and provider PITR remain operator configuration.

Read the [integrated runbook](docs/INTEGRATED_PLATFORM.md), [protocol](docs/PHASE1_SECURITY_PROTOCOL.md), [storage report](docs/PHASE3_SECURITY_AND_OPERATIONS.md), [adaptive study research](docs/PHASE4_ADAPTIVE_STUDY.md), [research catalog](docs/LEARNING_PLATFORM_RESEARCH.md) and [dependency license inventory](docs/DEPENDENCY_LICENSES.json). Third-party projects are references; their application code has not been copied.
