# Integrated branch review

Verified on 2026-10-22 on `feature/integrated-learning-platform-20261022`. The branch integrates main `de81d9c0aaaa48f6994a11ca4da4d7a0a94acc50`, including PR #7's room projections and submission guard, with Phase 1 PR #10, Phase 3 PR #15 and Phase 4 PR #11 while retaining main's visual exams and 11-kind question model. Research PR #5 supplies reference catalogs rather than application source.

The integration closes the original account/ownership gaps, replaces trusted player IDs with rotating credentials, and makes the server authoritative for multiplayer timing, scoring and state. It also joins private original documents, reviewed imports, editable questions, saved practice and FSRS under one account. Original teams, buzzer, wager, workshop and party modes reuse the secured game engine.

The [48-item status checklist](IMPLEMENTATION_CHECKLIST.md) identifies bounded implementations and incomplete operational work. The [runbook](INTEGRATED_PLATFORM.md) documents configuration and migration limits.

## Verified results

| Check | Actual result |
|---|---|
| TypeScript | `npm run check` passed. |
| Unit and real WebSocket tests | `npm test`: 51 passed, zero failed or skipped. Includes timers, reconnect rotation, host/player permissions, scoring, portable formats, extraction, schemas, matching, rate limits and main's projection/guard regressions. |
| Migrations | All five ordered migrations applied twice against the disposable local test database. |
| Database/API integration | Five passed, zero skipped, using PGlite's PostgreSQL engine over its socket adapter. Covers ownership, retained originals, FK cascades/rollback, study idempotency, drafts, reviewed publication, card editing and JSON restore. This does not substitute for native PostgreSQL 16 acceptance. |
| Browser acceptance | Five Chromium tests passed with retries disabled: join keyboard/axe/phone layout; cross-device private history and legacy practice saving; imported-card edit/reorder/reload; host/player match with both reconnecting; visual authoring/reopen/MCQ/matching/hotspot practice. |
| Build | Production client and server built. Client JS is about 666 kB before gzip (205 kB gzip), with a bundle-size warning. |
| Smoke | HTTP liveness, database readiness and actual WebSocket exchange passed against the test app. |
| Production dependency audit | Zero reported vulnerabilities at the checked lockfile. |
| Full dependency audit | Eight development advisories: five high, three moderate, in the Tailwind 3 glob/selector chain. These remain open; no forced Tailwind 4 migration. |
| License inventory | 280 installed production packages inventoried; no missing/review-required license metadata. This is not legal clearance. |

Local browser acceptance used Chromium 141 with Playwright 1.64.1 and Node 24.19.0. Native PostgreSQL binaries and the other browser runtimes were unavailable in this execution environment. The committed workflow targets Node 22, native PostgreSQL 16 and Playwright-managed Chromium/Firefox/WebKit; it still needs to run on the combined branch.

## Remaining acceptance and operator work

- Run `.github/workflows/integrated-platform.yml`, including native PostgreSQL, `pg_dump`/empty-target `pg_restore`, Firefox and WebKit. The local JSON restore test passed; native database archive restoration is unverified.
- Provision durable private object storage, enable independent original-file retention, and configure scheduled encrypted offsite database backups plus provider point-in-time recovery. The app adapters and scripts do not provision these services.
- Rehearse migration from a copy of any existing database. Ownerless legacy decks remain inaccessible until ownership is verified. A previously deployed separate Phase 4 account system needs explicit identity mapping; migration refuses to guess.
- Configure and acceptance-test a real private S3 bucket and optional HTTPS AI provider. Neither was accessed. PDF/DOCX extraction and evidence approval are tested locally; no OCR or live AI-output quality evaluation was performed.
- Complete a manual screen-reader/touch accessibility review and the full game-mode/browser matrix. Automated representative checks passed; full WCAG conformance is not claimed.
- Resolve the development dependency advisories through a separately validated build-tool update.

## Product limits

Live games accept single-choice questions with 2–4 options. Other universal types are solo practice. The editor supports six of the eleven model kinds. QTI supports QTI 2.1 single-choice and exact case-sensitive short-answer items/packages; Anki supports quoted two-column text and basic two-field legacy APKG text import. Unsupported custom processing, cloze, media and new compressed APKG formats are rejected without discarding the original upload.

JSON deck backups preserve content, question order, explanations and citations, including media references. Media bytes and learning history use their own backup paths. AI suggestions need exact source evidence and explicit owner approval/publication; scanned PDFs need OCR/transcription. Flashcard preview is local, while default study, legacy practice and universal practice persist results.

Rooms and WebSocket throttles are process-local. Use one long-running app process behind HTTPS; restarts end matches. Multiple replicas require shared room authority and limits. Account recovery/MFA and malware scanning are additional work.

## Publication status

Publication of the development branch and a draft pull request was explicitly authorized on 2026-10-22. This change is prepared for review; no production deployment or merge into main is included.
