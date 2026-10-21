# Trivia Lobby — Study and AI reference implementation audit
**Research date:** 2026-10-21  
**Scope:** Public GitHub repository metadata, source trees and selected README/source-code inspections. Advertised features are not runtime-verified. This is a **design extraction**, not a third-party code vendoring plan.

## Decision key
- **MIT**: possible to reuse appropriate code after dependency/security review and preserving license notices; no external code has been imported in this PR.
- **GPL-3.0 / AGPL-3.0**: study architecture; copying code into a differently licensed project carries copyleft/distribution obligations. Seek license review first.
- **No detected license**: use as functional reference only. Public visibility is *not* permission to reproduce code.
- **Archived / tiny / prototype**: treat as a design sketch; not an implementation standard.
- Source file paths are grounded in the repository trees checked on the research date.

## Knowt-inspired — document ingestion, folders, generated cards

### [t6c/study-deck-manager](https://github.com/t6c/study-deck-manager)
- **Observed stack:** Java 17, Maven, MySQL, JPA; CLI, not a browser app.
- **Source map:** `entity/{Folder,StudySet,Flashcard}.java`, `service/{Folder,StudySet,Flashcard}Service.java`, `repository/CrudRepository.java`, `src/test/java/com/studydeck/service/`.
- **Extract concepts:** separated folder/deck/card entities; service and repository boundaries; CRUD service tests.
- **For Trivia Lobby:** add courses/folders to PostgreSQL, search/filter, nested library navigation, integrity tests.
- **License/status:** no license detected. Reference-only; cannot lift Java implementation. A console prototype, not a complete Knowt clone.

### [git-ishaan-kumar/notes-to-flashcards](https://github.com/git-ishaan-kumar/notes-to-flashcards)
- **Observed stack:** Python, notebooks, Google GenAI, pypdf, python-docx.
- **Source map:** `notes_extractor.py` contains `extract_text_file`, `extract_pdf_file`, `extract_docx_file`, `process_document`; `flashcard_generator.py`; `flashcard_formatter.py`.
- **Extract concepts:** detect input MIME; extract PDF text and embedded imagery; generate cards separately from source extraction; format cards for portability.
- **For Trivia Lobby:** asynchronous ingestion adapter per format; provenance (source file ID, page, explanation); review before deck publication.
- **License/status:** MIT. Avoid direct port of Python code into browser; implement guarded server processing after private storage exists.

### [mvcharcos/knowting](https://github.com/mvcharcos/knowting)
- **Observed stack:** Python Streamlit, Supabase.
- **Source map:** `app.py`, `db.py`, `supabase_schema.sql`, `test_template.json`.
- **Extract concepts:** material-associated quizzes, page/timestamp citations, course roles, performance dashboards, JSON sharing.
- **For Trivia Lobby:** relational `source_documents`, `source_references`, `courses`, `course_members`, `questions`; role-based read/write access.
- **License/status:** GPL-3.0. Design reference unless compatible license decision; do not copy code into current project.

### [jarjk/crablit](https://github.com/jarjk/crablit)
- **Observed stack:** Rust terminal application; archived.
- **Source map:** `src/cards.rs`, `src/state.rs`, `src/config.rs`, example cards CSV.
- **Extract concepts:** concise card data model and simple bulk text import, which is useful independent of interface.
- **For Trivia Lobby:** tolerant CSV/TSV import with strict validation and explicit export; avoid proprietary vocabulary data.
- **License/status:** MIT, archived. Retain original implementation independence.

## Duolingo-inspired — practice pathways, progress

### [sanidhyy/duolingo-clone](https://github.com/sanidhyy/duolingo-clone)
- **Observed stack:** TypeScript, Next.js, Drizzle, server actions, authentication.
- **Source map:** `db/schema.ts`, `actions/user-progress.ts`, `actions/challenge-progress.ts`, `app/(main)/learn/unit.tsx`, `app/lesson/challenge.tsx`.
- **Extract concepts:** separate courses/units/lessons/challenges; progress keyed to authenticated user; server-side challenge state and rewards.
- **For Trivia Lobby:** course progress tables with guarded mutations and monotonic achievements; XP and practice pathways after accounts.
- **License/status:** MIT; do not migrate UI or branding wholesale. Reconcile database model with existing PostgreSQL tables first.

### [bryanjenningz/react-duolingo](https://github.com/bryanjenningz/react-duolingo)
- **Observed stack:** React, TypeScript, Next.js, Zustand, Tailwind.
- **Source map:** `src/components/LanguageCarousel.tsx`, `src/components/Calendar.tsx`, `src/hooks/useBoundStore.ts`, `src/hooks/useLeaderboard.ts`.
- **Extract concepts:** tidy lesson navigation, calendar UI, progress and leaderboard presentation.
- **For Trivia Lobby:** optional practice calendar and responsive learning-path UI; accessibility and reduced-motion controls.
- **License/status:** MIT, older updates. Beware mock or browser-only state in UI demos.

### [Saaswati/Duolingo-clone](https://github.com/Saaswati/Duolingo-clone)
- **Observed stack:** Next.js frontend, FastAPI/SQLAlchemy backend, SQLite and pytest.
- **Source map:** `backend/app/services/{gamification,grading,path}.py`, `backend/tests/test_gamification.py`, `backend/app/routers/lessons.py`, `frontend/app/lesson/[lessonId]/page.tsx`.
- **Extract concepts:** explicit server grading, lesson unlocking, reward rules and testable invariants.
- **For Trivia Lobby:** test server-authoritative XP to prevent trivially forged progress; use optional streaks rather than punishing pauses.
- **License/status:** no detected license. Functional reference only.

## Quizlet-inspired — flashcards, exams, portability

### [fkozlicki/quizlet-clone](https://github.com/fkozlicki/quizlet-clone)
- **Observed stack:** TypeScript, Next.js, Drizzle, PostgreSQL, OAuth.
- **Source map:** `apps/nextjs/src/components/learn-mode/learn-mode.tsx`, `apps/nextjs/src/app/study-sets/[id]/{flashcards,learn,match,test}/page.tsx`, `apps/nextjs/src/components/shared/edit-flashcard-dialog.tsx`, `apps/nextjs/src/components/folder/`.
- **Extract concepts:** the same immutable card source powering several modes; editing, set combining, folders, export.
- **For Trivia Lobby:** one canonical card schema, multiple practice modes, portable CSV/JSON backups, and future course folders.
- **License/status:** MIT. The current PR adds independent solo practice and portable import/export; no copied components.

### [quenti-io/quenti](https://github.com/quenti-io/quenti)
- **Observed stack:** substantial TypeScript monorepo with separate web/CDN services.
- **Source map:** `apps/next/`, `apps/cdn/src/auth.ts`; study set, user and learning routes within the web app.
- **Extract concepts:** clear service boundaries, portable sets, full-stack student accounts, and cross-device study design.
- **For Trivia Lobby:** eventual permissioned library, saved sessions, image and document assets, service routing.
- **License/status:** AGPL-3.0. Study architecture only pending licensing decision. Large monorepo—do not merge blindly.

### [JohnGrahn/LibreStudy](https://github.com/JohnGrahn/LibreStudy)
- **Observed stack:** React/TypeScript frontend, Bun/Hono API, PostgreSQL.
- **Source map:** `src/pages/{CreateTest,TakeTest,TestResults,DeckProgress}.tsx`, `src/server/api/routes/{import-export,tests,progress,decks}.ts`.
- **Extract concepts:** test generation separated from test-taking/results; dedicated import/export and progress APIs.
- **For Trivia Lobby:** a new practice page and future persistent results after secure account ownership.
- **License/status:** no detected license. Reference-only.

## NotebookLM-inspired — durable sources, citations, AI processing

### [lfnovo/open-notebook](https://github.com/lfnovo/open-notebook)
- **Observed stack:** Python API, Next.js frontend, dedicated commands and data models.
- **Source map:** `api/routers/sources.py` includes file-support checks, upload functions, source download, sync/async creation; `api/routers/source_chat.py`; `docs/3-USER-GUIDE/{adding-sources,citations}.md`; `frontend/src/components/sources/`.
- **Extract concepts:** original sources are first-class entities, separate from notebooks and generated notes; ingestion status and source citations.
- **For Trivia Lobby:** secure object-store file archive, job queue, parser output, quoted snippets with page anchors, versioned source metadata, permissioned downloads.
- **License/status:** MIT. Do not assume its local file handling is appropriate for deployment; design durable cloud storage with backups.

### [devyanshyadav/librenote-ai](https://github.com/devyanshyadav/librenote-ai)
- **Observed stack:** TypeScript/Next.js with authentication and notebook APIs.
- **Source map:** `src/app/api/notebooks/[notebook-id]/sources/route.ts`, `src/app/api/notebooks/[notebook-id]/studio/[artifact-type]/route.ts`, `src/app/api/chat/route.ts`, `src/app/(auth)/auth/`.
- **Extract concepts:** notebook-scoped source membership and generated artifact endpoints.
- **For Trivia Lobby:** explicit `notebook -> sources -> generated flashcards/tests` graph, immutable source references and regeneration jobs.
- **License/status:** MIT; AI accuracy, prompt-injection and auth boundaries still need independent review.

### [tom1030507/OpenNotebookLM](https://github.com/tom1030507/OpenNotebookLM)
- **Observed stack:** Python/FastAPI, SQLite + search, PDF/URL/YouTube adapters.
- **Source map:** `backend/app/adapters/{pdf,url,youtube}.py`, `backend/app/routers/{ingest,files,query,ownership,rate_limit}.py`, `backend/app/middleware/upload_body_limit.py`.
- **Extract concepts:** modular content adapters, ownership checks, bounded uploads and citations.
- **For Trivia Lobby:** background extraction workers, per-source verification, no untrusted URLs passed directly to server fetchers.
- **License/status:** MIT. Inspect SSRF, MIME validation and model output grounding before any future integration.

### [run-llama/notebookllama](https://github.com/run-llama/notebookllama)
- **Observed stack:** Python, LlamaCloud service, Streamlit, processing/query modules.
- **Source map:** `src/notebookllama/{documents,querying,processing,audio,workflow,verifying}.py`, `tests/test_document_management.py`, `tests/test_workflow.py`.
- **Extract concepts:** document ingestion and querying separated from richer optional audio workflows; document-management tests.
- **For Trivia Lobby:** provider-agnostic processing interfaces so core flashcards still work with AI disabled.
- **License/status:** MIT; some cloud features require third-party keys, pricing review and consent.

## Anki-inspired — memory retention and review history

### [YibinLong/Memochi](https://github.com/YibinLong/Memochi)
- **Observed stack:** Tauri, Rust, React, SQLite.
- **Source map:** `src-tauri/src/commands/review.rs` includes due-card queries, review submission, preview intervals, undo; `src-tauri/src/apkg/exporter.rs`; `src-tauri/src/csv_import.rs`; `src-tauri/migrations/006_review_log.sql`; `src/pages/Review.tsx`.
- **Extract concepts:** explicit review events, due dates, undo, portable import/export, predictable review scheduling.
- **For Trivia Lobby:** eventually persist per-user review events in PostgreSQL; use a separately tested SM-2/FSRS-type scheduling engine after accounts.
- **License/status:** MIT. Desktop SQLite code should not simply be transplanted into our web server.

### [Le0nX/anki-clone](https://github.com/Le0nX/anki-clone)
- **Observed stack:** Swift/iOS prototype.
- **Source map:** `anki-clone/anki-clone/Models/{Question,QuestionGroup,QuestionGroupData}.swift`, controllers and settings.
- **Extract concepts:** discrete question groups and app-layer architecture for mobile study.
- **For Trivia Lobby:** future offline mobile UI and state separation; not a browser-ready implementation.
- **License/status:** no detected license. Reference-only and dated.

### [BrokenMesh/AnkiClone](https://github.com/BrokenMesh/AnkiClone)
- **Observed stack:** C#/Avalonia, small desktop flashcard clone.
- **Source map:** `ViewModels/{Card,CardManager,CardViewModel}.cs`, `Dialog/EditCardDialog.axaml`, `Views/CardView.axaml`.
- **Extract concepts:** card-edit dialogs and model/view separation.
- **For Trivia Lobby:** dedicated reusable flashcard editor, simple keyboard-friendly study UI.
- **License/status:** MIT. Small prototype; not evidence of full Anki feature parity.

## Engineering conclusions
- Prefer **our existing stack** over embedding Next.js, Rust, Python, AngularJS, Java or Flutter runtimes in the same app.
- Prefer own TypeScript implementations informed by interfaces, API boundaries and data models; make third-party code reuse an explicit separately reviewed action.
- The current PR ships **solo practice, library search, portable CSV/JSON, and reliable card queue fixes**. It does **not** claim to ship document archives, AI, accounts, spaced repetition or cross-device progress.
- Prioritize private accounts/authorization **before** document uploads, and durable object storage **before** describing file retention as permanent.
