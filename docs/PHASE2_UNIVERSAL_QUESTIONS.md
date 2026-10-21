# Phase 2: Universal question engine and visual assessment

Status: **implementation PR; not production/security ready until CI and database E2E pass.**

## What was added

- New version-1 Zod question model in `shared/universal-questions.ts` derived from the repository owner's research PR #5 foundation. This is original app code, not copied from competitor repositories.
- Existing `decks` and `cards` tables, existing CSV/TSV/JSON import/export, flashcards, solo practice, and legacy WebSocket gameplay are preserved.
- Additive `universal_questions` PostgreSQL table with deck FK and ON DELETE CASCADE, JSONB definitions, per-deck ordering, and a unique (deck ID, SHA-256 normalized prompt/type) fingerprint.
- REST APIs for editing, listing, removing, ordering, viewing a key-free practice projection and **server-graded solo** answers.
- Mobile-responsive Exam Builder for multiple choice, matching and image hotspot questions, including diagram URL/alt text, pointer placement with [0,1] coordinates, numerical position input for keyboard users, and question reorder buttons.
- Visual Practice and local 30-second Timed Test routes. Supports single/multiple selection, matching, region selection, textual answers, true/false, ordering, flashcards and labeling via keyboard-friendly choices. Study scores are session-only.

**Defined and scored answer kinds (v1):** `text`, `flashcard`, `multiple_choice`, `multiple_select`, `true_false`, `short_answer`, `matching`, `ordering`, `drag_drop_labels`, `image_hotspot`, `diagram_identification`.

**Builder currently supports only three authoring types:** `multiple_choice`, `matching`, `image_hotspot`. Others have runtime scoring/projection models but not dedicated authoring controls; do not label them complete visual authoring modes. Files are linked via HTTPS URLs, **not uploaded**, retained or privately served.

## Migration and deployment

1. Back up the PostgreSQL database.
2. Run the existing app's baseline schema procedure if provisioning a new database, then apply:
   ```sh
   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/0001_universal_questions.sql
   ```
3. Verify `\d+ universal_questions` reports `deck_id` referencing `decks(id)` with `ON DELETE CASCADE`. Verify both indexes and JSONB.
4. Deploy app/backend on an environment with `DATABASE_URL`. Running the Phase 2 server against an unmigrated database causes question endpoints to fail (legacy endpoints remain separate).
5. Rollback of **application deployment**: deploy previous code and keep the additive table in place to avoid data loss. A destructive rollback may only be done manually after explicit backup and verification that no question data needs retaining.

The migration adds no columns to existing cards. Legacy adapters can convert supported flashcards and MCQs in memory, but no automatic rewrite or deletion of legacy cards occurs. Existing JSON backup exports **do not yet include universal questions**. The Phase 3 portable backup upgrade must cover both tables before claiming full export/restoration.

## API contract (all endpoints currently public)

- `GET /api/decks/:deckId/questions`: full authoring records (including keys) in sorted order.
- `POST /api/decks/:deckId/questions`: create versioned definition; server supplies immutable UUID inside definition.
- `PATCH /api/decks/:deckId/questions/:questionId`: update definition, preserving UUID.
- `DELETE /api/decks/:deckId/questions/:questionId`: remove.
- `PATCH /api/decks/:deckId/questions/reorder` with `{"ids":[2,1]}`: atomic reorder with exact ID-set validation.
- `GET /api/decks/:deckId/questions/practice`: key-free question projection (does not include explanations).
- `POST /api/decks/:deckId/questions/:questionId/check` with `{"response":{"selectedIds":["A"]}}`: server validates and returns `{correct, answer, explanation}` for solo practice reveal.

Response shapes by kind: MCQ/multi-select `{selectedIds:string[]}`, matching/labeling `{matchIds: Record<string,string>}` (each prompt/region ID maps to chosen **label text**), hotspot/diagram `{targetId:string}`, ordering `{orderIds:string[]}`, true/false `{value:boolean}`, text/flashcard `{text:string}`. Invalid payloads receive HTTP 400; duplicate prompt/type returns 409.

## Security boundaries and remaining high-priority work

**Do not use Phase 2 as a private document/exam system.** Existing deck endpoints have no accounts or ownership checks, so full answer definitions and authoring endpoints are publicly accessible. The practice projection hides answer keys but cannot serve as an authorization layer. Server-side competitive scoring, authenticated WS reconnects, host-only state transitions and server-authoritative timers still require Phase 1 hardening before visual questions participate in live rooms.

External HTTPS images may expose visitors' requests to the selected image host. Do not enter private document URLs or embed secrets; images have no permanent retention guarantee. No H5P, QTI or Anki importer was added and no external assets or branding were copied.

## Checks and acceptance exercises

```sh
npm ci
npm run check
npm run test
npm run build
```

Automated tests include schema/answer validation, key-free projections, malformed coordinates, matching, legacy conversion and (conditionally when `DATABASE_URL` and migration exist) true PostgreSQL persistence, reorder and rollback. **The DB test is skipped without a test database.** There are no Playwright/browser automation dependencies or verified multi-browser E2E runs yet.

Manual acceptance: create a deck using the existing flow; open Exam Builder; create one MCQ, one matching question and one image hotspot with a public HTTPS image; save; refresh browser; verify all three persist; reorder; edit; open visual practice and timed mode; answer right/wrong; inspect server responses; verify hotspot marker positions after browser resizing; repeat with keyboard. This sequence has **not** been claimed tested.

## Source license and provenance notes (2026-10-21)

All code in this PR is authored for Trivia Lobby. These external repositories were inspected as behavioral references only, with no code copied. Status below is **source reviewed** only, not successful runtime testing or compatibility certification.

| Project | Commit inspected | Reported license | Source evidence | Integration |
|---|---|---|---|---|
| [h5p/h5p-drag-question](https://github.com/h5p/h5p-drag-question) | `2db54624d80b38f2851b5046d9a7a4aaddf1120a` | No license reported by API; do not copy | `src/drag-question.js`, keyboard/ARIA drag/drop import relationships | Reference only |
| [h5p/h5p-image-hotspot-question](https://github.com/h5p/h5p-image-hotspot-question) | Pin commit before reuse | No license reported by API; do not copy | `image-hotspot-question.js`, `semantics.json` | Reference only |
| [quenti-io/quenti](https://github.com/quenti-io/quenti) | `b8fa3527c662c6a059875a0add36389f447b7d47` | AGPL-3.0 | `apps/next` | Reference only |
| [LongsightGroup/qti3](https://github.com/LongsightGroup/qti3) | `902996d89729a4a2a242f8f222eea4bbe281cff7` | MIT | `packages/core/package.json`, `packages/core`, player packages | Reference only |
| [fkozlicki/quizlet-clone](https://github.com/fkozlicki/quizlet-clone) | `2d93c6278183c7fd22cf9daaa383c52972cafa1c` | MIT | `apps/nextjs` | Reference only |
| [hugobarragon/react-quizzes](https://github.com/hugobarragon/react-quizzes) | `085a3963e3bdc7f70842ab53a690fa01a0adca4f` | MIT | `src/QuizzBuilder/FormBuilder.tsx` and tool container | Reference only |

Other requested repositories remain research leads, not verified integration claims. QTI/H5P interoperability needs a dedicated standards-conformance and licensing review.
