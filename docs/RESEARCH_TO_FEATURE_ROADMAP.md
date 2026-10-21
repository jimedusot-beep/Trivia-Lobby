# Trivia Lobby — research-to-feature roadmap

Updated: 2026-10-21. [Research catalog](./LEARNING_GAME_RESEARCH.md)

## Current baseline (from README and package.json)

React + TypeScript + Vite, Express 5 + WebSockets, PostgreSQL/Drizzle. Existing: decks/cards, flashcard view, live hosting/joining, CSV paste and CSV/TSV file preview/import. Limitations reported by README: no user/private-deck accounts, no retained original document files, no permanent document store. Do not treat future features as shipped.

## The architectural rule

**One owned question library, many original learning experiences.** Game modes consume normalized questions rather than storing game-specific copies. Server authoritatively scores multiplayer answers. Persist long-term study progress in PostgreSQL. Use original text, illustrations, icons and mechanics; third-party material is reference only.

## Proposed implementation queue

| Priority | Feature | Existing inspiration | Acceptance criteria |
|---|---|---|---|
| P0 | Durable account-owned source library | Open Notebook, LibreNote | Private accounts, authorization checks, retained originals with SHA-256, export/delete, storage limits and backups |
| P0 | Canonical question model | Quizlet clones, questgen | Stable question IDs; text/MCQ support; deck import/export; validated answers; one question reused across modes |
| P0 | Resilient live rooms | open-kahoot, quiz app | Server-side score and timers; reconnection; duplicate-answer rejection; deterministic room lifecycle |
| P1 | User-approved AI question drafting | notes-to-flashcards, Open Notebook | Source citation/page references; draft review; never auto-publish; record model and generation timestamp |
| P1 | Spaced repetition | Memochi, LibreStudy | Review schedule persisted per user/card; answer history and next-due query |
| P1 | Alternate modes | BetterBlooket, Gimkit examples | At least two original modes share cards; independent scoring policies; no pay-to-win or clone artwork |
| P2 | Learning paths & streaks | Lingo, Duolingo alternatives | Versioned lessons; timezone-safe streaks; XP validated on server; accessible skips and recovery |
| P2 | Teacher/host dashboard | Quizizz & Kahoot alternatives | Room control, roster, live progress, exportable results; privacy by default |
| P2 | Original game shop | Gimkit-like examples | Auditable currency ledger; idempotent purchases; upgrades cannot corrupt score |
| P3 | Offline/mobile experience | FlashBuddy, Memochi | Downloaded permitted decks, offline review, explicit sync conflicts |

## Reverse-engineering and AI development workflow (authorized references only)

1. Choose a **feature behavior**, not proprietary source or branding.
2. Record permitted public flows and functional requirements; avoid intercepting private data, bypassing access controls or reproducing paid-only materials without authorization.
3. Use isolated browser tools only on our own site or apps expressly authorized for inspection.
4. Have an AI coding agent implement an original specification in a separate branch.
5. Require a short ADR noting inputs, sources, rights, alternatives, tradeoffs, and tests.
6. Run TypeScript check, build, WebSocket integration tests, importer safety tests, authorization tests, and mobile accessibility checks.
7. Review the diff manually and merge only on passing checks.

## Explicitly deferred
- Copying complete apps, decompiling restricted binaries or reproducing proprietary API secrets.
- Bulk scraping user/customer data or bypassing subscriptions.
- Importing GPL/AGPL dependencies into the MIT project without legal and architectural review.
- Advertising features as complete because a reference repository claims them.

## First development slice

**Question model + reusable game-mode adapter** (after confirming current schema):
- Define typed Question, AnswerPolicy, GameMode, RoomState, and Result interfaces.
- Introduce a single server-side gradeAnswer function with tests.
- Keep existing CSV/TSV imports backward compatible.
- Refactor one existing live round to use the adapter; regression test flashcards and joining.
- Add a second original mode only after the first passes.

This roadmap is documentation, not an implementation or a passing test report.
