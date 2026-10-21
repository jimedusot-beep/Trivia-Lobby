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

Requires Node.js and a persistent PostgreSQL database. For the Phase 3 draft branch, also provision a private persistent source volume outside the repository.

```bash
npm ci
export DATABASE_URL='postgresql://...'
npm run db:push            # fresh database only
npm run db:migrate:phase3  # when running the Phase 3 branch
export PRIVATE_STORAGE_DIR='/srv/trivia-private'  # persistent private volume
npm run dev
```

The `DATABASE_URL` must point at a **persistent** PostgreSQL instance. Never commit credentials. Use a deployment platform that supports a long-running Node server and WebSockets.

## Import file format

Create a UTF-8 `.csv` or `.tsv` file (or restore a previously exported `.json` deck backup) with header names as below, then select it on **Create Deck** and preview before saving.

```csv
Front,Back,Type,OptionA,OptionB,OptionC,OptionD,CorrectOption
"What planet is called the Red Planet?","Mars","multiple_choice","Earth","Mars","Jupiter","Venus","B"
"What does DNA stand for?","Deoxyribonucleic acid","flashcard",,,,,
```

On the main branch, existing browser CSV/TSV/JSON imports save deck/card records to PostgreSQL and do not retain originals. **Draft Phase 3 PR #15 adds private accounts and a separate Source Library flow** that retains the original before explicit preview/approval. The legacy Create Deck importer still only saves derived cards; use Source Library if original retention matters. Private bytes survive deployments only if the operator provides durable database and volume storage with tested backups. Study progress and complete account export are not implemented. Do not use sensitive student data on an unreviewed deployment.

## Engineering research library (October 2026)

- [Learning-game clones, AI-assisted creator leads, and reconstruction tools](docs/LEARNING_GAME_RESEARCH.md) — 28 platform-inspired repositories, creator/tool leads, evidence classifications, license and verification checklist.
- [Research-to-feature roadmap](docs/RESEARCH_TO_FEATURE_ROADMAP.md) — priorities and acceptance criteria for the current React/Express/WebSocket/PostgreSQL app.

These are **research references only**. No third-party code, proprietary assets, AI agents, or reverse-engineering packages are installed by these documents; proposed game modes are not yet implemented.

- [AI reconstruction expansion: five research and testing tracks](docs/research/AI_RECONSTRUCTION_TRACKS.md) — evidence-linked specifications, host/player automation, original UI prototypes, replay QA, and case studies. [Structured inventory](docs/research/ai-reconstruction-candidates.json) (`node --test tests/research-manifest.test.mjs`). [Implementation issue #6](https://github.com/jimedusot-beep/Trivia-Lobby/issues/6).

## Phase 3 implementation under review

[Draft PR #15](https://github.com/jimedusot-beep/Trivia-Lobby/pull/15) adds accounts, ownership controls, original-file retention, searchable folders/tags and a human-approved import preview. [Phase 3 security and operational runbook](docs/PHASE3_SECURITY_AND_OPERATIONS.md) lists the supported formats, migration steps, CI evidence and important remaining security gaps. **This PR is not merged and not a guarantee of production readiness.**

## Product direction

1. **Study library:** permanent original PDF/DOCX/PPTX/TXT/CSV uploads, private accounts, folders, searchable notes, and source-linked cards.
2. **Study loop:** spaced repetition, self-tests, streaks, daily practice, and progress by course.
3. **Game night:** host/join rooms, timed questions, scoreboards, teams, friend/family packs, and accessible mobile play.
4. **Content creation:** bulk importing, document-to-card suggestions with human review, editing, duplicates, and exports.
5. **Reliability:** backups, private files, restoration tests, import limits, audit logs, and clear retention policy.

See [Import & storage plan](docs/IMPORT_AND_STORAGE.md) for security, data retention, and hosting considerations. See also the [28-project reference audit and integration blueprint](docs/research/INTEGRATION_BLUEPRINT.md).

## Deployment note

The current Express/WebSocket server is **not** a drop-in static Netlify deploy. A static frontend on Netlify would also need a separate long-running backend, PostgreSQL, a documented WebSocket URL, and correct cross-origin routing; alternatively deploy the full app on a Node host supporting WebSockets. Do not assume Netlify alone will keep rooms and files alive.
