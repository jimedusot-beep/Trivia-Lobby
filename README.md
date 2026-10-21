# Trivia Lobby 🎮📚

**One app for family game night and college study.** Trivia Lobby combines live multiplayer quiz battles, reusable flashcards, and an evolving personal study library. Inspired by the *types* of learning experiences offered by Kahoot, Duolingo, and Quizlet; not affiliated with them.

## Repositories consolidated

This is the **single active codebase**: [jimedusot-beep/Trivia-Lobby](https://github.com/jimedusot-beep/Trivia-Lobby). [Trivia-lobb](https://github.com/jimedusot-beep/Trivia-lobb) was an empty duplicate, and now points here. Nothing needed to be copied from it.

## Already in the app

- Flashcard decks and study view
- Host/join live trivia games with WebSockets
- Database-backed decks and cards with PostgreSQL
- CSV/TSV paste or file selection, preview and validation, with an **all-or-nothing PostgreSQL import transaction**
- New: versioned Trivia Lobby JSON backup restore plus CSV/JSON backup downloads from each deck's study screen
- New: searchable deck library and solo multiple-choice practice; small decks use reveal-and-rate instead of made-up distractors
- New: review missed flashcards within the same study session (fixed queue behavior)
- TypeScript, regression tests and production build in GitHub Actions

## Getting started

Requires Node.js and a persistent PostgreSQL database.

```bash
npm ci
export DATABASE_URL='postgresql://...'
export SESSION_SECRET='a-long-random-secret-with-at-least-32-characters'
# In production, also set APP_ORIGIN=https://your-site.example
# Set TRUST_PROXY=1 only when deployed behind your trusted reverse proxy.
npm run db:push
npm run dev
```

The `DATABASE_URL` must point at a **persistent** PostgreSQL instance. Never commit credentials. Use a deployment platform that supports a long-running Node server and WebSockets.

## Authentication, existing data and deployment

Account passwords are hashed with scrypt, login sessions are stored in PostgreSQL and sent through HttpOnly SameSite cookies. Every deck and card API operation checks for the signed-in owner. Hosting requires a short-lived single-use ticket; players join with a room code and reconnect with server-issued credentials.

**Before upgrading a populated database**, take a verified provider-managed backup, then run `npm run db:push`. Existing pre-account decks have `owner_id = NULL` and are intentionally invisible to new accounts. An administrator must identify the rightful owner and assign those specific decks **only after verifying ownership**. Do not automatically assign all historical decks to the first account.

```sql
SELECT id, title FROM decks WHERE owner_id IS NULL;
-- Only after verifying the correct user/deck mapping:
-- UPDATE decks SET owner_id = '<verified-user-uuid>' WHERE id = <verified-deck-id> AND owner_id IS NULL;
```

Set a stable secret `SESSION_SECRET` (32+ characters) and canonical `APP_ORIGIN` in production. Production session cookies require HTTPS; set `TRUST_PROXY=1` only behind a trusted TLS-terminating proxy. Runtime WebSocket rooms remain process-local and disappear on server restart. Distributed rate limiting, provider-managed daily database backups, restore drills and a deployment smoke check remain required operational work. See [P0 verification and migration runbook](docs/P0_MULTIPLAYER_DATA_VERIFICATION.md).

## Import file format

Create a UTF-8 `.csv` or `.tsv` file (or restore a previously exported `.json` deck backup) with header names as below, then select it on **Create Deck** and preview before saving.

```csv
Front,Back,Type,OptionA,OptionB,OptionC,OptionD,CorrectOption
"What planet is called the Red Planet?","Mars","multiple_choice","Earth","Mars","Jupiter","Venus","B"
"What does DNA stand for?","Deoxyribonucleic acid","flashcard",,,,,
```

Imported deck/card records persist **only as long as the connected PostgreSQL database is retained**. The original source file is not yet stored; keep your own source copy for now. The app now has password-based accounts and owner-scoped deck APIs on the security review branch; deploy only after applying the updated schema and reviewing the authentication configuration. Permanent original-document storage and cross-device study review progress are still not implemented. Save your own JSON backup regularly; downloaded backups contain **cards only**, not original uploaded files. Do not upload confidential student materials to a public deployment until the P0 security pull request, operational backup/recovery, and deployment review are complete.

## Engineering research library (October 2026)

- [Learning-game clones, AI-assisted creator leads, and reconstruction tools](docs/LEARNING_GAME_RESEARCH.md) — 28 platform-inspired repositories, creator/tool leads, evidence classifications, license and verification checklist.
- [Research-to-feature roadmap](docs/RESEARCH_TO_FEATURE_ROADMAP.md) — priorities and acceptance criteria for the current React/Express/WebSocket/PostgreSQL app.

These are **research references only**. No third-party code, proprietary assets, AI agents, or reverse-engineering packages are installed by these documents; proposed game modes are not yet implemented.

- [AI reconstruction expansion: five research and testing tracks](docs/research/AI_RECONSTRUCTION_TRACKS.md) — evidence-linked specifications, host/player automation, original UI prototypes, replay QA, and case studies. [Structured inventory](docs/research/ai-reconstruction-candidates.json) (`node --test tests/research-manifest.test.mjs`). [Implementation issue #6](https://github.com/jimedusot-beep/Trivia-Lobby/issues/6).

## Product direction

1. **Study library:** permanent original PDF/DOCX/PPTX/TXT/CSV uploads, private accounts, folders, searchable notes, and source-linked cards.
2. **Study loop:** spaced repetition, self-tests, streaks, daily practice, and progress by course.
3. **Game night:** host/join rooms, timed questions, scoreboards, teams, friend/family packs, and accessible mobile play.
4. **Content creation:** bulk importing, document-to-card suggestions with human review, editing, duplicates, and exports.
5. **Reliability:** backups, private files, restoration tests, import limits, audit logs, and clear retention policy.

See [Import & storage plan](docs/IMPORT_AND_STORAGE.md) for security, data retention, and hosting considerations. See also the [28-project reference audit and integration blueprint](docs/research/INTEGRATION_BLUEPRINT.md).

## Deployment note

The current Express/WebSocket server is **not** a drop-in static Netlify deploy. A static frontend on Netlify would also need a separate long-running backend, PostgreSQL, a documented WebSocket URL, and correct cross-origin routing; alternatively deploy the full app on a Node host supporting WebSockets. Do not assume Netlify alone will keep rooms and files alive.
