# Flashcards, document libraries, spaced review and grounded activities

Research snapshot: **2026-10-25**. Trivia Lobby baseline: [`0341181653`](https://github.com/jimedusot-beep/Trivia-Lobby/tree/0341181653c00f0015b71339517bbc71d6530c2a).

Evidence labels: **DOC** = retrieved publisher documentation; **SRC** = inspected pinned source, not executed; **TEST** = command actually run; **DESIGN** = original proposed behavior, not a competitor claim. A file existing is not proof its feature works. None of the competitor applications were run, and no proprietary implementation was inspected. See [comparison and validation](REA_FEATURE_COMPARISON.md) for shared limits and [assignments](REA_IMPLEMENTATION_ASSIGNMENTS.md) for delivery contracts.

## Publisher sources and scope

- **DOC S1:** [Quizlet study modes](https://quizlet.com/features/study-modes) documents flashcards and multiple study activities; [Flashcards help](https://help.quizlet.com/hc/en-ca/articles/360030988091-Studying-with-Flashcards) describes sorting into learning/known groups. No current subscription entitlement or exact adaptive formula is asserted.
- **DOC S2:** [Knowt creating flashcards](https://help.knowt.com/en/articles/10716239-how-do-i-create-and-edit-flashcards) documents starting from files, scratch and imports. [Getting started](https://help.knowt.com/en/articles/10722204-student-s-guide-to-getting-started) describes several study modes. Import quality and supported-file edge cases were not tested.
- **DOC S3:** [Anki studying manual](https://docs.ankiweb.net/manual/studying) describes deck overview, question-before-answer and Again/Hard/Good/Easy with interval previews. This does not establish the alternatives implement the same scheduler.
- **DOC S4:** [Google's source and fact-checking announcement](https://blog.google/innovation-and-ai/products/notebooklm-goes-global-support-for-websites-slides-fact-check/) documents NotebookLM sources and citations; [Discover Sources](https://blog.google/innovation-and-ai/models-and-research/google-labs/notebooklm-discover-sources/) describes adding retrieved sources. Source-grounded output is not guaranteed factual truth. No private Google notebook was accessed.

Reference count: Quizlet 2, Knowt-workflow alternatives 2, Anki 2, NotebookLM 3. Knowt references implement document-to-card or library subproblems; they are explicitly not full Knowt clones. The upstream [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) is a scheduler library, not an extra independently developed Anki clone. Trivia Lobby already pins version 5.4.2; do not silently upgrade to its current upstream main during guest work.

## Original workflows and behavior (DESIGN)

| Activity | Navigation and states | Error/recovery contract |
| --- | --- | --- |
| Public flashcards | Demo catalog → deck → question → reveal → self-rate/next → summary | Empty set explains absence; reload resumes current version; keyboard reveal must not submit a rating |
| Practice test | Choose supported types/count → start → answer → submit → results → retry misses | Frozen question snapshot; incomplete response confirmation; refresh preserves attempt locally |
| Local spaced review | Due overview → recall → reveal → rating + next interval → next due | No rating before reveal; duplicate event creates one state transition; invalid local dates isolated |
| Private document intake | Existing authorized upload → validation → extraction → preview → draft cards → edit/approve → publish | Failed parsing keeps original accessible; retries do not duplicate published cards; cancel cannot claim publication |
| Grounded public activity | Curated source → cited sample question → answer/explanation → open supporting passage | Missing passage shows unavailable status; no fabricated citation or inferred page number |
| Library organization | Search/filter → folder/topic → saved deck/source → activity | Owner boundary on all mutations; folder deletion does not silently erase source files |

## Baseline and proposed architecture

Existing account functionality includes CSV/JSON and portable deck formats, private file archive/routes, visual questions, practice, FSRS schedules, review history/export, AI-assisted draft generation and publication. `server/library.ts` checks ownership and exposes original/preview/media routes. `server/study-drafts.ts` asks for evidence, rejects non-substring evidence and requires approval before publishing. A substring match proves quotation presence, **not that an answer follows from it**. Do not label generated material verified merely because the quote exists.

For public learning, add an immutable original demo pack containing question IDs, content version, attribution and optional sample source passages. Run it through local adapters; never make `/api/library` or `/api/study` anonymous. `GuestProgressStore` keys schedules by `{packId,version,itemId}` with review events and scheduler version. Factor the pure scheduler for browser-safe reuse if needed, without bundling database/auth imports. Local events are honest about device-only retention and deletion risk; provide export/reset. Treat repeated review ID with different card/rating as conflict, matching account semantics.

For a later library slice, owner-scoped folder/topic entities and membership references can organize existing decks/files; use soft organizational operations with explicit delete behavior. For a later grounded-source slice, attach `{sourceId,sourceVersion,passage,startOffset,endOffset,page?}` to drafts. Verify bounds and source ownership at generation and publication, show the passage for human review, and invalidate citations on source replacement. Page is optional and displayed only when extraction knows it. If AI provider is unavailable, show clear status and retain deterministic/manual authoring. Keep account credentials, private source text and signed URLs out of guest packs, browser logs and public reports.

## Learning-science and accessibility requirements

Recall must precede reveal. Again means failed recall; Hard is recalled with difficulty, not a substitute for “wrong.” The current account analytics uses ratings >=3 as correct, so treat this as an existing product convention to review explicitly rather than silently changing history. Intervals are estimates; explain due dates without promising memory retention. One schedule per learner/card; multiplayer speed or currency must not alter it. Explanations and original passages support review, but human approval is not an empirical validation of educational accuracy.

Support flip and rating through separate labeled controls, 1–4 shortcuts only after reveal and outside text entry, readable text reflow and reduced motion. Source readers need selectable text and titled citations, not screenshot-only evidence. Image questions require meaningful alt text; give a text alternative or clear unsupported notice where a visual spatial task cannot be equivalent.

## Specific tests and budgets (DESIGN, unrun)

1. Same 10-item public pack powers flashcards, five-question practice and local due review with stable IDs. Switching modes does not mutate prompts or fabricate completed reviews.
2. Freeze time; replay Again/Hard/Good/Easy fixtures through pinned scheduler and round-trip serialized state. New/corrupt/invalid dates fail safely. Replayed review event leaves due date unchanged; reload restores intervals.
3. Reveal and rating are distinct keyboard actions; rating cannot fire before reveal. Three missed items generate a bounded retry queue with no lost or duplicate items.
4. Private source/deck IDs supplied to public adapters are rejected. Unauthenticated requests to original/preview/media/generation/publish remain unauthorized; user A cannot fetch user B's citations.
5. Fixture source with an irrelevant but real quotation must be marked for human review, not certified correct. Unsupported quote rejected; source version mismatch blocks publish; repeated publish is idempotent. Test malicious instructions inside source text as data.
6. Malformed/oversize import and archive bombs fail within configured bounds without changing existing data. Scanned PDF with no text reports that OCR is unavailable unless actually implemented. Parser timeout retains original and visible failed status.
7. Guest due queue selection p95 <100 ms for 1,000 items on recorded phone; show ≤100 due items per page. Proposed private ingest UI acknowledgment <500 ms independent of extraction completion; document actual size/parser limits rather than claiming arbitrary files. Worker concurrency and extraction timeouts need measured limits before larger-file support.

## Limitations and handoff

No competitor import, OCR, model generation or spaced-review runtime was tested. Pinned selected source and publisher docs support bounded design extraction. G4 covers local persistence; G10 covers citation validation; G11 covers folders. Public document upload is not required for a no-sign-in demo and must not be added by weakening private authorization.

## Pinned repository evidence

All listed projects are independently maintained references/alternatives; they are not official competitor source. Metadata and selected files were checked on the research date. “Not archived” is a GitHub flag, not a maintenance or quality guarantee.

### [fkozlicki/quizlet-clone](https://github.com/fkozlicki/quizlet-clone)

- Snapshot: `2d93c6278183c7fd22cf9daaa383c52972cafa1c`; not archived; last push reported `2025-04-01T18:19:15Z`; fork flag `False`.
- License: **MIT**. Root license files inspected: `LICENSE`. Public source without a clear grant is reference-only; custom and copyleft terms require separate review before reuse. No code/assets imported.
- **SRC:** [`apps/nextjs/src/components/learn-mode/learn-mode.tsx`](https://github.com/fkozlicki/quizlet-clone/blob/2d93c6278183c7fd22cf9daaa383c52972cafa1c/apps/nextjs/src/components/learn-mode/learn-mode.tsx). Learn view switches from a multiple-choice card to completion results and a list of studied terms.
- Useful pattern and limitation: TypeScript/Next.js monorepo. UI consumes a learn hook; selection, persistence and grading guarantees require separate tests.

### [quenti-io/quenti](https://github.com/quenti-io/quenti)

- Snapshot: `b8fa3527c662c6a059875a0add36389f447b7d47`; not archived; last push reported `2026-04-15T21:03:08Z`; fork flag `False`.
- License: **AGPL-3.0**. Root license files inspected: `LICENSE`. Public source without a clear grant is reference-only; custom and copyleft terms require separate review before reuse. No code/assets imported.
- **SRC:** [`apps/next/src/modules/flashcards/controls-bar.tsx`](https://github.com/quenti-io/quenti/blob/b8fa3527c662c6a059875a0add36389f447b7d47/apps/next/src/modules/flashcards/controls-bar.tsx). Flashcard controls share a set/folder abstraction through useSetFolderUnison.
- Useful pattern and limitation: TypeScript monorepo; useful shared-set controls and study navigation. AGPL source is a behavioral reference; do not transplant components.

### [t6c/study-deck-manager](https://github.com/t6c/study-deck-manager)

- Snapshot: `2ab0311038950fdc4f0f4c13ab2166b421be3dfc`; not archived; last push reported `2026-06-09T05:23:48Z`; fork flag `False`.
- License: **none detected**. Root license files inspected: none found. Public source without a clear grant is reference-only; custom and copyleft terms require separate review before reuse. No code/assets imported.
- **SRC:** [`src/main/java/com/studydeck/service/FolderService.java`](https://github.com/t6c/study-deck-manager/blob/2ab0311038950fdc4f0f4c13ab2166b421be3dfc/src/main/java/com/studydeck/service/FolderService.java). Folder service validates trimmed nonempty names, finds, lists, updates and deletes via a repository.
- Useful pattern and limitation: Java CLI/library organization alternative, not a Knowt clone or browser app. Owner-scoped queries and folder cycle protection still need original design.

### [git-ishaan-kumar/notes-to-flashcards](https://github.com/git-ishaan-kumar/notes-to-flashcards)

- Snapshot: `0b0c9bde1aabefbd32e99be0fa3e3d6e0d695de5`; not archived; last push reported `2026-09-02T21:27:30Z`; fork flag `False`.
- License: **MIT**. Root license files inspected: `LICENSE`. Public source without a clear grant is reference-only; custom and copyleft terms require separate review before reuse. No code/assets imported.
- **SRC:** [`notes_extractor.py`](https://github.com/git-ishaan-kumar/notes-to-flashcards/blob/0b0c9bde1aabefbd32e99be0fa3e3d6e0d695de5/notes_extractor.py). Separate TXT/PDF/DOCX extraction returns text and, for PDF/DOCX, image parts for downstream processing.
- Useful pattern and limitation: Python document-to-card alternative, not Knowt parity. Filename-based dispatch is insufficient MIME validation; image extraction does not prove OCR or page-accurate citations.

### [YibinLong/Memochi](https://github.com/YibinLong/Memochi)

- Snapshot: `833cfe894d1b7e07236db638fa350f8974c770c3`; not archived; last push reported `2026-01-24T05:54:55Z`; fork flag `False`.
- License: **MIT**. Root license files inspected: `LICENSE`. Public source without a clear grant is reference-only; custom and copyleft terms require separate review before reuse. No code/assets imported.
- **SRC:** [`src-tauri/src/commands/review.rs`](https://github.com/YibinLong/Memochi/blob/833cfe894d1b7e07236db638fa350f8974c770c3/src-tauri/src/commands/review.rs). Due queries return review cards and interval previews; submit_review saves previous state for undo and calls an SM-2 scheduler.
- Useful pattern and limitation: Rust/Tauri/SQLite Anki alternative. This inspected snapshot uses SM-2, not FSRS; learn from review history and undo boundaries.

### [BrokenMesh/AnkiClone](https://github.com/BrokenMesh/AnkiClone)

- Snapshot: `62ee818b6961cb5c11fdf671c14cef039985f18e`; not archived; last push reported `2024-06-21T07:07:37Z`; fork flag `False`.
- License: **MIT**. Root license files inspected: `LICENSE`. Public source without a clear grant is reference-only; custom and copyleft terms require separate review before reuse. No code/assets imported.
- **SRC:** [`ViewModels/CardManager.cs`](https://github.com/BrokenMesh/AnkiClone/blob/62ee818b6961cb5c11fdf671c14cef039985f18e/ViewModels/CardManager.cs). Card manager loads/saves JSON, edits cards, counts enabled due cards and selects the earliest due card.
- Useful pattern and limitation: C#/Avalonia desktop prototype. File IO and local singleton state are not transactional multi-user persistence.

### [lfnovo/open-notebook](https://github.com/lfnovo/open-notebook)

- Snapshot: `a0f6f3081ae06328f0a451b3a3ef2959ca25721d`; not archived; last push reported `2026-10-20T10:52:09Z`; fork flag `False`.
- License: **MIT**. Root license files inspected: `LICENSE`. Public source without a clear grant is reference-only; custom and copyleft terms require separate review before reuse. No code/assets imported.
- **SRC:** [`api/routers/sources.py`](https://github.com/lfnovo/open-notebook/blob/a0f6f3081ae06328f0a451b3a3ef2959ca25721d/api/routers/sources.py). Source router has file support checks, source-status models, processing commands and bounded error presentation.
- Useful pattern and limitation: Python/Next.js NotebookLM alternative. Large service surface; not audited end to end. Sources as first-class records and separate processing status are useful.

### [devyanshyadav/librenote-ai](https://github.com/devyanshyadav/librenote-ai)

- Snapshot: `7d8950b7ac048fbf691d4fce7da6010050832a03`; not archived; last push reported `2026-08-23T17:09:51Z`; fork flag `False`.
- License: **MIT**. Root license files inspected: `LICENSE`. Public source without a clear grant is reference-only; custom and copyleft terms require separate review before reuse. No code/assets imported.
- **SRC:** [`src/app/api/notebooks/[notebook-id]/sources/route.ts`](https://github.com/devyanshyadav/librenote-ai/blob/7d8950b7ac048fbf691d4fce7da6010050832a03/src/app/api/notebooks/[notebook-id]/sources/route.ts). Notebook sources route resolves a user and calls listNotebookSources with user ID and notebook ID.
- Useful pattern and limitation: Next.js NotebookLM alternative. The route indicates a scoped service boundary; this alone does not prove all service authorization paths.

### [tom1030507/OpenNotebookLM](https://github.com/tom1030507/OpenNotebookLM)

- Snapshot: `0bef6b869cb8e42cab4e4d9b554307b5fe056dc2`; not archived; last push reported `2026-10-25T10:43:52Z`; fork flag `False`.
- License: **MIT**. Root license files inspected: `LICENSE`. Public source without a clear grant is reference-only; custom and copyleft terms require separate review before reuse. No code/assets imported.
- **SRC:** [`backend/app/routers/ingest.py`](https://github.com/tom1030507/OpenNotebookLM/blob/0bef6b869cb8e42cab4e4d9b554307b5fe056dc2/backend/app/routers/ingest.py). Ingest router separates file, URL, YouTube and text inputs; uses document service and ingestion concurrency leases.
- Useful pattern and limitation: Python/FastAPI alternative. Useful adapter and bounded-job pattern; no claim SSRF, extraction quality or ownership protections were runtime-tested.
