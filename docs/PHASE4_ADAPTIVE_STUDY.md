# Phase 4 — Adaptive study and memory (2026-10-21)

## Branch and scope
This branch is an additive Phase 4 feature based on `main` commit `71bcea23`. PR #5 remains open and is not included here. Existing trivia scoring is not modified. **Phase 1 security/ownership fixes have not been merged into main**; do not mistake these private study-account routes for a general deck-authorization system.

## Research: actual license files and inspected source paths

| Repository | License/source evidence | Decision |
|---|---|---|
| `ankitects/anki` | Root `LICENSE` says **AGPL-3.0-or-later**; Rust `Cargo.toml` and Python `pylib/anki/collection.py` corroborate | Architecture only; no Anki source copying |
| `open-spaced-repetition/ts-fsrs` | `v5.4.2/packages/fsrs/package.json`: version 5.4.2, **MIT**, Node >=20; `src/fsrs.ts` exposes `next`; `src/models.ts` defines due/reps/lapses. Main is now v6 beta, requiring Node >=24; avoid beta | Depend on **5.4.2**, no copied scheduling implementation |
| `YibinLong/Memochi` | MIT `LICENSE`, `src-tauri/migrations/006_review_log.sql`, `src-tauri/src/commands/review.rs`, `src-tauri/src/scheduler/queue.rs` | Conceptual review history/queue reference |
| `ChloeVPin/openlet` | MIT `LICENSE` (master), `lib/fsrs.ts`, `drizzle/0002_auth_rls_migration.sql` | Study FSRS boundary and auth/RLS approach |
| `anton-bregolas/nobs-fsrs-cards` | **GPL-3.0** root `LICENSE`, `src/components/ReviewButtons.tsx` and tests | Design reference only; do not copy |
| `openSRS-App/openSRS` | MIT root `LICENSE` on master; React Native mobile tree | Reference only; non-web stack |
| `Le0nX/anki-clone` | No root LICENSE detected on master; small Swift/iOS prototype | Functional inspiration only, no reuse |
| `BrokenMesh/AnkiClone` | MIT `LICENSE` on master; small C#/Avalonia desktop project | UX reference only |
| `sanidhyy/duolingo-clone` | MIT `LICENSE`, `actions/{challenge-progress,user-progress}.ts`, lesson routes | Milestone/permission design reference |
| `bryanjenningz/react-duolingo` | MIT `LICENSE` on master; React progress/navigation components | UI inspiration only |
| `Saaswati/Duolingo-clone` | No root LICENSE detected; backend/frontend app | Functional reference only |
| `DoradoDevs/ai-study-flashcards-app` | MIT `LICENSE`, `src/components/{multiple-choice-session,free-recall-session}.tsx` | Study-mode concepts only; avoid product/asset copying |
| `BlueRaddish/open-sourced` | MIT `LICENSE`, `src/components/ProgressView.tsx`, `src/lib/resources.ts` | Progress UI reference only |
| `yerdaulet-damir/openquiz` | No root LICENSE detected; `app/lib/{quizStore,satSessionManager,useProgress}.ts` | Behavior reference; no source reuse |
| `Congmoow/QuestPilot` | Custom restrictive Chinese `LICENSE`: study/academic reference only; copying, redistributing and commercial use prohibited without permission. `src/features/question-preview/components/DuplicateCheckDialog.tsx`, `src-tauri/src/database/repositories/draft_repo.rs` | **Never copy** |
| `lfnovo/open-notebook` | MIT `LICENSE`, `api/routers/{sources,source_chat}.py`, auth routes | First-class source and citation workflow reference |

The repository's original `docs/research/STUDY_AI_REFERENCE_AUDIT.md` contains the preceding audit for several sources. Listed paths prove presence of implementation surfaces, **not** successful runtime verification, comprehensive security audit, or maintained feature parity. This PR uses original TypeScript and React code, not copied third-party components.

## Persistence and algorithm
- An authenticated user receives their own `study_schedule` row for each reviewed card (serialized FSRS state, dueAt, lastRating, needsWork, reviewedAt) and append-only `study_events` with before/after snapshot, due transitions, requestId, rating, and timestamps.
- The server calculates FSRS ratings **Again=1, Hard=2, Good=3, Easy=4** using `ts-fsrs@5.4.2`, 90% desired retention, fuzz disabled for deterministic tests. Server time is authoritative.
- A transaction-level `pg_advisory_xact_lock` serializes competing reviews of the same user/card. Each user/requestId pair is unique and duplicate submissions return their prior event without rescheduling.
- New cards enter the due queue without needing a saved schedule row. Default due queue excludes future due cards. `missed` queue contains the latest pending weaknesses; successful ratings clear needsWork.
- History and export are resolved exclusively using authenticated user identity from a hashed, expiry-bound random cookie token. No browser-provided `userId` is accepted.
- Analytics use the most recent 10,000 review events and up to 20,000 cards; a 30-minute inactivity boundary defines sessions. Subject-level improvement compares the latest 10 answers with the previous 10 in a subject, with no result when the previous window is empty. Export includes all review events and states. Streaks are informational and do not revoke achievement milestones.
- Course progress is derived from existing deck/category: Explore (any reviewed), Cover (all reviewed), Retain (80% of cards with FSRS intervals 21+ days). These are original, non-punitive milestones, not teacher-managed lesson authoring or forced unlocks.
- **Deleting a public deck currently cascades its per-card review history.** Preserve/soft-delete cards before production if a permanent audit trail is required.

## Deploy
1. Back up PostgreSQL. Review and apply `migrations/0004_phase4_study.sql` to an existing Trivia Lobby DB after cards/decks tables exist: `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/0004_phase4_study.sql`. This migration is additive and uses `IF NOT EXISTS` with explicit constraints. Alternatively reconcile Drizzle schema with an existing migration management strategy; do **not** blindly run against production.
2. `npm ci && npm run check && npm test && npm run build`; start normally with `DATABASE_URL` configured.
3. Open `/learning`, register a 12+ character password, navigate to a deck's **Adaptive** queue; reveal a card and select one of four ratings.
4. Review on a second browser by signing in with the same account. History, schedule and progress are server-persisted; no local-storage secret.
5. To run optional DB integration tests, provision an **isolated migrated** test database and set `STUDY_TEST_DATABASE_URL` before `npm test`. GitHub Actions provisions an isolated PostgreSQL 16 service and sets this variable, so the cross-device/privacy test runs there without being skipped.

### Optional AI (off by default)
Supply `STUDY_AI_ENDPOINT` as a server-operator-configured HTTPS JSON endpoint, optionally `STUDY_AI_API_KEY`. The adapter sends `{task, limit, instructions, source: {title,text}}`; expects `{cards:[{front,back,evidence}]}`. Evidence must be an **exact substring** of an account-owned source and duplicate questions are rejected. Source text is transferred to the operator-configured provider **only** when the signed-in user selects Suggest cards. Suggested cards remain private, unapproved, and editable, including their optional explanations. Approval does **not** publish to global decks. Never log source contents or place API keys in client bundles.

## Security and QA gates before production
- **Block deployment until Phase 1** replaces insecure public deck/card editing, room-code generation and WebSocket reconnect flows. Existing deck endpoints remain unauthenticated; they cannot safely host private teacher content. Do not expose AI to legacy unowned decks.
- The new email/password auth is deliberately scoped to private study data; before broader rollout add email verification/password recovery, account-deletion UI, externally backed rate limits, token cleanup/revocation policy and abuse monitoring.
- CI provisions PostgreSQL, applies Drizzle's schema and replays the additive SQL migration; it then executes the privacy/cross-device API integration test, unit tests, TypeScript and bundle build. CI does not apply this migration to production databases. Cross-device E2E is exercised with two independently authenticated HTTP sessions, not actual browser automation.
- Backups, retention/deletion policy and source-provider privacy disclosures are required before students upload sensitive materials.
