# Integration and maintenance review

Verified on 2026-10-22. PR #21 merged the consolidated implementation into main at `e649b07eee0f0a48fe772ca8f39da3817da8f90e`. All seven screenshot PRs (#5, #8, #10, #11, #15, #20, #21) are merged. Main's own [CI](https://github.com/jimedusot-beep/Trivia-Lobby/actions/runs/39814796100) and [integrated acceptance](https://github.com/jimedusot-beep/Trivia-Lobby/actions/runs/39814795907) passed after that merge.

PR #22 merged the build-tool security maintenance at `d4f44ff03f3a152b9622606391d7ca4d6336ea6b`, clearing the remaining development advisories and adding compiled-stylesheet checks. Its [acceptance run](https://github.com/jimedusot-beep/Trivia-Lobby/actions/runs/39818024805) passed all nine scenarios in each browser (27 total), native PostgreSQL and encrypted recovery. PR #23 merged the game-mode, mobile layout and bundled-font follow-up at `a11a12bef3e7ab38eb100feb1445469e452e1b68`. Its post-merge [CI](https://github.com/jimedusot-beep/Trivia-Lobby/actions/runs/39822799253) and [integrated acceptance](https://github.com/jimedusot-beep/Trivia-Lobby/actions/runs/39822799268) passed, including all 15 scenarios in each browser (45 total) without retries.

The integration closes the original account/ownership gaps, replaces trusted player IDs with rotating credentials, and makes the server authoritative for multiplayer timing, scoring and state. It also joins private original documents, reviewed imports, editable questions, saved practice and FSRS under one account. Original teams, buzzer, wager, workshop and party modes reuse the secured game engine.

The [48-item status checklist](IMPLEMENTATION_CHECKLIST.md) identifies bounded implementations and incomplete operational work. The [runbook](INTEGRATED_PLATFORM.md) documents configuration and migration limits.

## Verified results

| Check | Actual result |
|---|---|
| TypeScript | `npm run check` passed. |
| Unit and real WebSocket tests | 57 passed locally, zero failed or skipped. Includes timers, reconnect rotation, host/player permissions, scoring, portable formats, extraction including text-free PDFs, schemas, matching, rate limits and main's projection/guard regressions. |
| Migrations | All five ordered migrations applied twice against native PostgreSQL 16 in hosted acceptance and against the disposable local PGlite database. |
| Database/API integration | Five passed, zero skipped, on native PostgreSQL 16 in hosted acceptance; five also pass using local PGlite over its socket adapter. Covers ownership, retained originals, FK cascades/rollback, study idempotency, drafts, reviewed publication, card editing and JSON restore. |
| Native database archive | `pg_dump`, archive validation/checksum and empty-target atomic `pg_restore`, plus authenticated encrypted recovery of exact database contents and retained original bytes, passed in hosted acceptance. This is a disposable CI database, not a production backup configuration. |
| Browser acceptance | Through merged PR #23, 15 tests passed in each of Chromium, Firefox and WebKit (45 total), with retries disabled: keyboard/axe/phone layouts; private history and saved practice; imported-card editing; all six game modes and reconnects; visual MCQ/matching/hotspot authoring/practice; compiled layout, long-content and bundled-font checks. |
| Build | Production client and server built. Client JS is about 675 kB before gzip (207 kB gzip), with a bundle-size warning. |
| Smoke | HTTP liveness, database readiness and actual WebSocket exchange passed against the test app. |
| Production dependency audit | Zero reported vulnerabilities at the checked lockfile. |
| Full dependency audit | Zero vulnerabilities across production and development dependencies after the Tailwind 4 migration. CI runs the full audit at moderate severity and above; no advisory exceptions or suppression. |
| License inventory | 282 installed production packages inventoried; no missing/review-required license metadata. This is not legal clearance. |

Local browser acceptance uses Chromium 141 with Playwright 1.64.1 and Node 24.19.0; hosted acceptance uses Node 22 and native PostgreSQL 16. The merged main acceptance run above includes repeated migrations, five database/API tests, native archive restoration, encrypted original-file recovery and all three browser engines. The build-tool follow-up also passes 57 unit/socket tests, five native PostgreSQL/local PGlite database/API tests, and nine scenarios in each browser, including two compiled-style scenarios covering phone/tablet/desktop layouts and keyboard focus. The new home-layout check exposed tablet-width action overflow; wrapping the action row fixes it. See [BUILD_TOOL_MIGRATION.md](BUILD_TOOL_MIGRATION.md) for the dependency and browser compatibility changes. The game-mode follow-up locally passes five additional Chromium scenarios for balanced teams/aggregate scores, buzzer expiry and wrong-answer handoff, wager gains/losses/reconnect, workshop upgrade persistence and one-time consumption, and party scoring after host reload. It also records any animation-canvas creation to check reduced-motion behavior. See [GAME_MODE_ACCEPTANCE.md](GAME_MODE_ACCEPTANCE.md); A dedicated app fixture preserves the real room-creation rate limit while isolating mode tests from classic matches. Firefox also exposed mobile dashboard overflow; wrapping long account/study text, constraining subject filters and using shrinkable grid/flex content fixes it, with a deterministic compiled-style regression. A WebKit trace showed external font CSS delaying the authenticated page after successful sign-in. The two UI font families are now bundled, with license notices and a reload-synchronized sign-in check; the compiled-style scenarios verify font readiness, no external font requests and browser zoom. See [FONT_PROVENANCE.md](FONT_PROVENANCE.md). All 15 scenarios passed in every engine before PR #23 merged and again on its merged main revision.

## Production startup follow-up

The built launcher now verifies private storage and runs packaged additive migrations before opening the HTTP/WebSocket listener. The Replit entry point uses Node 22 and the launcher. A separate production-runtime CI job removes development dependencies and starts only built artifacts against a fresh PostgreSQL database; it checks cookies, retained text/PDF originals, PDF worker extraction, a restart and a scored socket match. Local disposable-PGlite acceptance passes; hosted production-runtime results are recorded in the follow-up PR. This is deployment-artifact validation, not evidence of a published production URL. See [PRODUCTION_STARTUP.md](PRODUCTION_STARTUP.md).

## Remaining acceptance and operator work

- Provision durable private object storage, enable independent original-file retention, and configure scheduled encrypted offsite database backups plus provider point-in-time recovery. The app adapters and scripts do not provision these services.
- Rehearse migration from a copy of any existing database. Ownerless legacy decks remain inaccessible until ownership is verified. A previously deployed separate Phase 4 account system needs explicit identity mapping; migration refuses to guess.
- Configure and acceptance-test a real private S3 bucket and optional HTTPS AI provider. Neither was accessed. PDF/DOCX extraction and evidence approval are tested locally; no OCR or live AI-output quality evaluation was performed.
- Complete a manual screen-reader/touch accessibility review. Automated representative checks passed; full WCAG conformance is not claimed.

## Product limits

Live games accept single-choice questions with 2–4 options. Other universal types are solo practice. The editor supports six of the eleven model kinds. QTI supports QTI 2.1 single-choice and exact case-sensitive short-answer items/packages; Anki supports quoted two-column text and basic two-field legacy APKG text import. Unsupported custom processing, cloze, media and new compressed APKG formats are rejected without discarding the original upload.

JSON deck backups preserve content, question order, explanations and citations, including media references. Media bytes and learning history use their own backup paths. AI suggestions need exact source evidence and explicit owner approval/publication; scanned PDFs need OCR/transcription. Flashcards, default study, legacy practice and universal practice all persist results.

Rooms and WebSocket throttles are process-local. Use one long-running app process behind HTTPS; restarts end matches. Multiple replicas require shared room authority and limits. Account recovery/MFA and malware scanning are additional work.

## Publication status

The consolidated implementation, build-tool maintenance and game-mode/mobile/font follow-up are merged through PRs #21, #22 and #23. Repository merges do not configure or deploy the production database, object storage, AI provider or backup schedule.

## PR consolidation

The screenshot PRs #5, #8, #10, #11, #15 and #20 are reconciled into #21 with their branch heads preserved in Git ancestry. See [PR_CONSOLIDATION.md](PR_CONSOLIDATION.md) for resolution decisions. New checks cover oversized-frame survival and unanswered-round streak resets. Encrypted recovery includes retained originals and a native PostgreSQL content drill. Browser acceptance runs one engine per bounded job with stale-run cleanup. Production backup enablement requires operator secrets and retention configuration.
