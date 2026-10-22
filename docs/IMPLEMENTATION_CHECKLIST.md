# Requested work status

All 48 requested items are tracked below. **Implemented** describes the merged source and recorded checks, not a production rollout. **Partial** identifies a narrower implementation or unfinished acceptance work. **Pending operations** requires deployment configuration that was not available. Exact verification is recorded in [INTEGRATION_REVIEW.md](INTEGRATION_REVIEW.md).

| # | Priority | Requested item | Status and evidence/limits |
|---|---|---|---|
| 1 | P0 Security | Accounts and authentication | Implemented: one scrypt account, hashed DB sessions and protected private routes. |
| 2 | P0 Security | Authorize every deck/card operation | Implemented: owner-filtered CRUD, imports, editing, question operations, exports, drafts and practice. Cross-account API tests pass. |
| 3 | P0 Security | Secure player reconnect credentials | Implemented: rotating hashed bearer credentials, socket binding and stale credential rejection; socket/browser reconnect tests pass. |
| 4 | P0 Security | Collision-resistant room codes | Implemented: cryptographic codes, collision checks, bounded rooms and join throttles. Codes remain invitations rather than a private-room password. |
| 5 | P0 Security | Validate incoming WebSocket messages | Implemented: strict versioned schemas, 4 KB frames, phase and role checks. |
| 6 | P0 Security | Rate limits and abuse controls | Implemented: bounded API/auth/import, socket, join, creation and answer controls; single-process limits. |
| 7 | P0 Security | Sanitize outbound game data | Implemented: explicit protocol projections, answer keys/results withheld until reveal, no socket objects or source passages. |
| 8 | P0 Multiplayer | Fix message contracts | Implemented: shared protocol and client/server event shapes. |
| 9 | P0 Multiplayer | Round-result events | Implemented: reveal commits scores, correct answer, individual results and leaderboard. |
| 10 | P0 Multiplayer | Server-side timers | Implemented: authoritative deadlines and late-answer rejection tested with real sockets. |
| 11 | P0 Multiplayer | Game state transitions | Implemented: lobby, playing, reveal, leaderboard and finished snapshots. |
| 12 | P0 Multiplayer | Complete multiplayer test | Implemented: socket match covers two players, invalid actions and deadlines; browser match covers host/player reload, reconnect and finish. |
| 13 | P0 Data | Transactional deck deletion | Implemented: atomic owner-filtered deletion and FK cascades; rollback coverage. |
| 14 | P0 Data | Relational foreign keys | Implemented: additive migrations validate references and enforce cascades; native PostgreSQL 16 acceptance passes. |
| 15 | P0 Data | Durable database backups | Pending operations: native archive restoration and encrypted database-plus-original-file recovery pass hosted rehearsal; production scheduling, offsite storage and retention/PITR remain. |
| 16 | P1 Data | Save original documents | Implemented: bounded validated original bytes retained with hashes; authorized retrieval tested. |
| 17 | P1 Data | Secure object storage | Partial: private volume and encrypted private S3 adapter implemented; production bucket/retention and S3 acceptance pending. |
| 18 | P1 Data | Folders, courses and tags | Implemented: private library metadata and organization UI. |
| 19 | P1 Data | Search document contents | Implemented: extracted PDF/DOCX/PPTX/text contents and PostgreSQL full-text search; scans require transcription/OCR. |
| 20 | P1 Data | Import idempotency/deduplication | Implemented: owner-scoped receipts, content hashes and normalized card deduplication; conflicting answers require explicit editing. |
| 21 | P1 Data | Backup export/restoration tests | Implemented: v2 JSON round-trip tests preserve cards, universal definitions, order and citations. Media bytes/history have separate paths. |
| 22 | P1 Study | Universal question schema | Implemented: one versioned eleven-kind model/grader; main's richer representation preserved. |
| 23 | P1 Study | Image hotspot exams | Implemented: private diagram selection, normalized target authoring, click/keyboard practice and grading. |
| 24 | P1 Study | Drag-and-drop matching | Implemented: drag, touch selection and labeled menu alternatives; grading/browser coverage. |
| 25 | P1 Study | Question editing/reordering | Implemented: universal editor and legacy imported-card editor; IDs/history retained on edits; order survives reload. Editor supports six model kinds. |
| 26 | P1 Study | Mastery/performance histories | Implemented: private attempts, weak-card notebook, dashboard and export. |
| 27 | P1 Study | FSRS spaced repetition | Implemented: pinned ts-fsrs with persisted schedules, atomic ratings and deterministic tests. |
| 28 | P1 Study | Cross-device study progress | Implemented: shared account-backed legacy/universal histories; independent browser-context reload test passes. |
| 29 | P1 Study | Timed/untimed practice | Implemented: universal practice modes and saved missed answers; solo timer is local, competitive timer is server-authoritative. |
| 30 | P1 Study | Explanations/source citations | Implemented: authoring, backups and post-check explanations, attribution/page/source passages. |
| 31 | P1 Quality | Expanded unit tests | Implemented: 57 unit/socket tests pass for schema, scoring, imports, backups, matching, extraction (including text-free PDFs), permissions and projection/guard regressions. |
| 32 | P1 Quality | Playwright host/player E2E | Implemented: 15 scenarios pass in each of Chromium, Firefox and WebKit (45 total) on merged main through PR #23, including all six modes and long-content/mobile/font regressions. |
| 33 | P1 Quality | PostgreSQL integration tests | Implemented: five API/relational tests pass on native PostgreSQL 16 and PGlite; repeated migrations and native archive restoration pass. |
| 34 | P1 Quality | Dependency/license audits | Implemented: full production/development audit reports zero vulnerabilities after the validated Tailwind 4 migration; CI now audits both scopes. Inventory records 282 packages with no missing/review-required license metadata. |
| 35 | P1 Quality | Deployment smoke tests | Implemented: HTTP/DB/real-WS smoke passes; built-runtime fresh-database/restart acceptance added with dev dependencies removed. Actual hosted URL smoke remains pending deployment. |
| 36 | P1 Quality | Reconcile main/research branches | Implemented: main (including PR #7 projections/guards) plus Phase 1/3/4 ancestry, research catalogs and unified account/schema integration; all seven screenshot PRs (#5, #8, #10, #11, #15, #20, #21) merged through PR #21. |
| 37 | P1 Experience | Host/player feedback/errors | Implemented: visible reconnect state, invalid action/deadline errors, acknowledgments and restored answered state. |
| 38 | P1 Experience | Mobile/accessibility audit | Partial: phone overflow, keyboard, labels, menu alternatives, reduced motion (including live-game celebrations), browser zoom, bundled fonts and representative axe checks pass; full manual screen-reader/touch audit pending. |
| 39 | P1 Experience | Draft save/recovery | Implemented: private server drafts, optimistic revisions, recovery, keepalive flush and visible save/conflict feedback. |
| 40 | P2 AI | Flashcards from PDF/DOCX | Partial: source extraction and optional HTTPS generation adapter implemented; real provider configuration/quality acceptance and OCR remain. |
| 41 | P2 AI | Evidence-linked reviewed questions | Implemented: exact source-evidence filter, editable suggestions, owner approval and idempotent publication; no live-provider evaluation. |
| 42 | P2 AI | Difficulty-adaptive practice | Implemented: weak/due/unknown priority and recent-accuracy difficulty bucket; a rule-based policy rather than an external model. |
| 43 | P2 Games | Team competition | Implemented: balanced teams and server-computed aggregate scoring. |
| 44 | P2 Games | Original shops/upgrades | Implemented: workshop earned coins, Focus bonus and Guard protection; server validates costs/phase/consumption. |
| 45 | P2 Games | Buzzer, wagering and party modes | Implemented: five-second buzzer turn, bounded virtual-point wagers and every-third-round party multiplier; all six modes have browser acceptance scenarios in the three-engine CI matrix. See GAME_MODE_ACCEPTANCE.md. |
| 46 | P2 Integration | QTI/Anki import/export | Partial format coverage: QTI 2.1 single-choice/exact text items and ZIP packages; quoted two-column Anki text round-trip and basic legacy APKG text import. Unsupported custom/cloze/media/new compressed variants rejected. |
| 47 | P2 Integration | Review research candidates | Implemented: reference catalog/source audits retained; no third-party application code transplanted. |
| 48 | P2 Integration | Provenance/license inventory | Implemented: research references/audits, branch ancestry, generated dependency inventory and original-image prompt recorded. Upstream licensing changes still require review before reuse. |
