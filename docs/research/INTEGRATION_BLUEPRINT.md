# Trivia Lobby — integration blueprint (not a code mash-up)

**Vision:** One persistent, secure study library that turns source material into (a) college practice, (b) flashcards, and (c) multiplayer family trivia. The same deck can be replayed in several modes. All interfaces, art, and game rules must be original.

Reference investigations:
- [17 study/AI repositories](STUDY_AI_REFERENCE_AUDIT.md)
- [11 multiplayer/game repositories](MULTIPLAYER_GAME_REFERENCE_AUDIT.md)
- The product's first implementation PR: [#4](https://github.com/jimedusot-beep/Trivia-Lobby/pull/4)

## What this PR actually ships
| Deliverable | Implementation | Storage | Verification |
|---|---|---|---|
| Solo quiz/practice | `client/src/pages/Practice.tsx`, `client/src/lib/practice.ts` | session-only score; no claim of cross-device progress | unit tests, TypeScript and build CI |
| Return missed flashcards | `client/src/pages/Study.tsx` | only within current session | source review |
| Search saved deck titles/categories | `client/src/pages/Home.tsx` | reads existing PostgreSQL decks | build CI |
| CSV/TSV validation + JSON restore | `client/src/lib/deck-io.ts`, `client/src/pages/ImportDeck.tsx` | cards/decks saved to existing PostgreSQL (atomic import) | roundtrip and validation tests |
| Download CSV/JSON backups | `client/src/lib/deck-io.ts`, study page | file created on user's computer | roundtrip tests |
| Module-by-module research | `docs/research/` | GitHub codebase | link/source verification |

## Non-negotiable privacy / ownership gates

**Current app has unauthenticated deck APIs and should not be used for private college files on a public deployment.** A deck can currently be viewed or deleted by anyone who can reach its API. New uploads must not be enabled for private documents until authenticated ownership is enforced and verified.

### Phase A — identity and safe data ownership
- Add `users`, `families`, `family_members`, `libraries`, `collections` with owner IDs; migration scripts.
- Add server sessions (secure HttpOnly cookies), CSRF protection, per-library authorization (create/read/update/delete), invitation flow, rate limits and access tests.
- Change legacy public decks to an explicit migration state; no retroactive claim that old data is private.
- Implement soft-delete + restore window, not irreversible client-only deletion. Require authorization server-side.
- Tests: owner can access; another user cannot enumerate/read/modify/delete; expired session and cross-family requests rejected.

### Phase B — durable originals
- Add `source_files` (owner, SHA-256, original filename, safe type, bytes, object key, created/updated timestamps, status/version), `source_extracts` (page, text, citations), `ingestion_jobs`, `deck_sources`.
- Store originals in **private, versioned object storage** (S3-compatible), not GitHub, process memory, Netlify build output or a temporary file path.
- Postgres holds structured deck data/metadata; exact file contents stay in object storage. Use signed upload/download URLs only after ownership authorization.
- Enforce file size/type limits, anti-malware scanning, privacy defaults, upload idempotency, failed-upload cleanup and async extraction.
- Test restart/redeploy retention, exact-byte download with checksums, duplicate upload and interrupted upload, PostgreSQL restoration, object-storage restoration, deletion and export.

### Phase C — AI from documents, with source verification
- Add format adapters for TXT/CSV/TSV first, then PDF/DOCX/PPTX; carry page/slide references.
- Keep source text untrusted, isolate parsing jobs and guard URL ingestion against SSRF. No models execute instructions embedded in uploaded documents.
- Generate suggested cards/tests, **never publish automatically**; show source text/citation for each answer and require user review.
- Use provider-neutral AI gateway with quotas, budget limits, model version, provenance and fallback when AI unavailable.
- Test hallucination, prompt-injected source content, wrong citations, malformed documents, reprocessing and data loss on failure.

### Phase D — mastery and multiplayer improvements
- Persist authenticated review events, due dates, correctness and progress; separate flashcard scheduling from game scores.
- Add editable flashcard sets, true/false, matching, written responses, spaced repetition, course milestones and optional XP.
- Server-authoritative live-game state and scoring; reconnect snapshots, game TTL, message size/rate limits, host ownership.
- Add classic/teams/powerups modes as independent plugins using one validated question bank; cosmetics must be original.
- Tests: multi-client game start/join/reconnect/timeout/answer/reveal/leaderboard; no duplicated points; no cheating via browser state.

## Reuse/license policy
- **Current PR:** no third-party code/asset copied. Concepts/architectural patterns were independently implemented.
- For an MIT-licensed module, check its own LICENSE, dependencies, provenance and notices before considering reuse. Preserve notices and SPDX/attribution.
- GPL-3.0/AGPL-3.0: do not mix source into this repo before making explicit licensing decisions. AGPL may impose obligations for network use.
- No license or `NOASSERTION`: reference-only absent author permission. README claims are not an adequate substitute.
- Do not use other projects' artwork, sound effects, mascots, logos, student content, API keys, or hidden credentials.

## Hosting implications
Trivia Lobby currently has React + Vite, Express + PostgreSQL and a long-running WebSocket server. Netlify static hosting **alone** is not sufficient. Either host the full stack on a Node platform with persistent WebSocket support, or configure a distinct backend/WS service with correct security, domain and CORS settings.

## Release acceptance criteria
- Unit tests (import/export, quiz generation, review progression), TypeScript check, build and CI all pass.
- Browser E2E tests cover import -> study -> practice -> export -> re-import.
- Auth and object-storage tests pass before accepting any confidential user file.
- Database backups and source-file restore are independently tested; no "permanent" guarantee without recovery.
- All imported code and assets have a clear rights ledger and software-composition/security audit.
- Performance/accessibility mobile audit and real-player multiplayer smoke tests before public launch.

**Operational truth:** No code change can guarantee indefinite file retention. Design for durable storage, backups, recovery, exports, and explicit deletion rather than claiming data will be saved literally forever.
