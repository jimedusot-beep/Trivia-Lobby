# Learning-platform source research and integration catalog

> **Historical research inventory (October 21, 2026).** The app-state descriptions, security findings, roadmap and “not completed” statements below describe the original research branches; they are not a current audit. Check current code, tests and the [integration review](INTEGRATION_REVIEW.md) for present status. Follow the [feature-by-feature REA workflow](../CONTRIBUTING.md): select one feature, investigate only what is needed, specify it, implement an original version and test it before moving on. These links are optional leads, not a research prerequisite or a commitment to integrate every project.

Research inventory assembled 2026-10-21. **Reference list, not a dependency manifest.** The repository links below are leads for code-level review, not declarations that source has been audited, copied, tested, or licensed for redistribution. Check current licensing on the specific commit before reuse. "Clone" often means independently recreated UI/functionality, **not** leaked or decompiled proprietary software.

## Existing research: 28 repositories across nine platforms

| Platform | Repository | Focus |
|---|---|---|
| Knowt | [t6c/study-deck-manager](https://github.com/t6c/study-deck-manager) | Decks, folders |
| Knowt | [git-ishaan-kumar/notes-to-flashcards](https://github.com/git-ishaan-kumar/notes-to-flashcards) | File-to-cards |
| Knowt | [mvcharcos/knowting](https://github.com/mvcharcos/knowting) | Learning library, sources |
| Knowt | [jarjk/crablit](https://github.com/jarjk/crablit) | CSV/TSV importing |
| Kahoot | [ethanbrimhall/kahoot-clone-nodejs](https://github.com/ethanbrimhall/kahoot-clone-nodejs) | Rooms, multiplayer |
| Kahoot | [soleilvermeil/open-kahoot](https://github.com/soleilvermeil/open-kahoot) | Socket.IO hosting |
| Kahoot | [rotemtam/kahootClone](https://github.com/rotemtam/kahootClone) | Realtime Firebase |
| Duolingo | [sanidhyy/duolingo-clone](https://github.com/sanidhyy/duolingo-clone) | Learning paths, XP |
| Duolingo | [bryanjenningz/react-duolingo](https://github.com/bryanjenningz/react-duolingo) | React learning UI |
| Duolingo | [Saaswati/Duolingo-clone](https://github.com/Saaswati/Duolingo-clone) | Progression, grading |
| Quizlet | [fkozlicki/quizlet-clone](https://github.com/fkozlicki/quizlet-clone) | Study modes, folders |
| Quizlet | [quenti-io/quenti](https://github.com/quenti-io/quenti) | Full-stack study platform |
| Quizlet | [JohnGrahn/LibreStudy](https://github.com/JohnGrahn/LibreStudy) | Tests, spaced repetition |
| NotebookLM | [lfnovo/open-notebook](https://github.com/lfnovo/open-notebook) | Persistent sources, citations |
| NotebookLM | [devyanshyadav/librenote-ai](https://github.com/devyanshyadav/librenote-ai) | Documents, quizzes |
| NotebookLM | [tom1030507/OpenNotebookLM](https://github.com/tom1030507/OpenNotebookLM) | PDF/web/YouTube input |
| NotebookLM | [run-llama/notebookllama](https://github.com/run-llama/notebookllama) | Document processing |
| Blooket | [TacoJack21/BetterBlooket](https://github.com/TacoJack21/BetterBlooket) | Game/collection UI |
| Blooket | [marty-on-linux/Blooket-2.0](https://github.com/marty-on-linux/Blooket-2.0) | Alternate quiz modes |
| Blooket | [hackerman-101/blobkit](https://github.com/hackerman-101/blobkit) | Experimental game UI |
| Gimkit | [s-tn/Gimkit-Clone](https://github.com/s-tn/Gimkit-Clone) | Shop, rooms |
| Gimkit | [manjun-stuff/gimkit-clone](https://github.com/manjun-stuff/gimkit-clone) | WASM game prototype |
| Gimkit | [kilroyjones/questgen](https://github.com/kilroyjones/questgen) | Source-to-questions |
| Anki | [YibinLong/Memochi](https://github.com/YibinLong/Memochi) | APKG, spaced repetition |
| Anki | [Le0nX/anki-clone](https://github.com/Le0nX/anki-clone) | iOS study architecture |
| Anki | [BrokenMesh/AnkiClone](https://github.com/BrokenMesh/AnkiClone) | Simple review client |
| Wayground/Quizizz | [LNMCode/MQChoice-Quizizz-clone](https://github.com/LNMCode/MQChoice-Quizizz-clone) | Live quizzes |
| Wayground/Quizizz | [stevenjr-yt/Quiz-Platform](https://github.com/stevenjr-yt/Quiz-Platform) | Teacher dashboard |
| Wayground/Quizizz | [csivitu/quizizzclone](https://github.com/csivitu/quizizzclone) | Browser quiz editor |

**Counting correction:** the original user-supplied table has **29** linked repos when the Gimkit companion `questgen` is included, not 28. It contains 28 direct category entries plus one companion.

## Additional 18 implementation references

| Area | Repository | Technical evaluation target |
|---|---|---|
| Visual | [h5p/h5p-drag-question](https://github.com/h5p/h5p-drag-question) | Image labeling |
| Visual | [h5p/h5p-image-hotspot-question](https://github.com/h5p/h5p-image-hotspot-question) | Point-and-click answers |
| Visual | [h5p/h5p-image-hotspots](https://github.com/h5p/h5p-image-hotspots) | Study-diagram hotspots |
| Review | [open-spaced-repetition/ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) | Review scheduler |
| Review | [ChloeVPin/openlet](https://github.com/ChloeVPin/openlet) | Image occlusion, FSRS |
| Review | [DoradoDevs/ai-study-flashcards-app](https://github.com/DoradoDevs/ai-study-flashcards-app) | Study modes |
| Review | [BlueRaddish/open-sourced](https://github.com/BlueRaddish/open-sourced) | Local backups |
| Review | [anton-bregolas/nobs-fsrs-cards](https://github.com/anton-bregolas/nobs-fsrs-cards) | Offline PWA |
| Review | [yerdaulet-damir/openquiz](https://github.com/yerdaulet-damir/openquiz) | Quiz generation |
| Review | [openSRS-App/openSRS](https://github.com/openSRS-App/openSRS) | Cross-device study |
| Multiplayer | [mawoka-myblock/ClassQuiz](https://github.com/mawoka-myblock/ClassQuiz) | Hosting, classroom rooms |
| Multiplayer | [sivasooryagiri/quizlive](https://github.com/sivasooryagiri/quizlive) | Realtime polling |
| Library | [learningequality/kolibri](https://github.com/learningequality/kolibri) | Offline-first sources |
| Library | [learningequality/studio](https://github.com/learningequality/studio) | Content organization |
| Library | [learningequality/ricecooker](https://github.com/learningequality/ricecooker) | Import pipelines |
| Assessment | [moodle/moodle](https://github.com/moodle/moodle) | Question bank semantics |
| Assessment | [h5p/h5p-question-set](https://github.com/h5p/h5p-question-set) | Mixed question sets |
| Rendering | [remarkjs/react-markdown](https://github.com/remarkjs/react-markdown) | Study note rendering |

Separate authoritative interoperability reference: [ankitects/anki](https://github.com/ankitects/anki), the original Anki source.

## Current app reality

The repository uses **Vite/React 18 + Express + ws + Drizzle/PostgreSQL**. It already supports decks/cards, CSV/TSV file import with a transactional save, and live host/join rooms. It does **not** store uploaded originals; it does not have private accounts and folders; active games live in server memory; and it has no PDF/DOCX importer, FSRS persistence, hotspot player, or generalized plugin engine yet. See [IMPORT_AND_STORAGE.md](IMPORT_AND_STORAGE.md).

## Implementation roadmap and acceptance criteria

1. **Interchange schema (initial foundation added):** `shared/universal-questions.ts` defines a versioned internal schema for text, MCQ, image hotspot, and matching, plus explicit conversion of supported legacy cards. It is **not wired into the UI or database**. Test invalid answer IDs, duplicate IDs, coordinates, empty questions, and backwards compatibility before adoption.
2. **Visual exam builder:** authenticated source image storage; normalized hotspot coordinates and responsive scaling; image labeling/matching UI; keyboard alternatives and accessible descriptions; answer validation on the server for scored multiplayer modes.
3. **Reliable library:** accounts, per-deck authorization, private durable original-file storage, content hashes, quotas, malware screening, signed URLs, backups and restoration drills. Never store private student documents in Git.
4. **Import adapters:** preview and human approval; CSV/TSV/JSON first, then PDF/DOCX/PPTX and legitimate APKG/H5P exports. Preserve original attribution, provenance, and media ownership. No undocumented private APIs.
5. **Memory scheduler:** evaluate ts-fsrs, add persistent review history and per-user scheduling, write deterministic scheduling tests, and keep game scores separate from memory ratings.
6. **Multiplayer hardening:** validate inbound messages, authorize rooms, keep answer keys out of player payloads, add reconnection/expiration logic, rate limits, and server-side scoring.
7. **Original games:** reuse the universal question model across classic quiz, match, labeling, teams, and a separately designed shop/reward game.
8. **Quality gate:** typecheck, automated tests, database migration and rollback checks, license review and dependency/security audit before merge.

### Important security issue found in existing server

`server/routes.ts` currently trusts the `playerId` supplied during room joining/rejoining. A guessable or acquired player ID may allow impersonation. It also sends the full leaderboard player objects including `ws` handles, and the current MCQ validation should be audited before competitive use. Address connection identity and sanitize outbound player payloads before making multiplayer public. These are observations, **not fixes included in this documentation PR**.

## Code-reuse policy

Use verified licenses at specific commits, retain notices and attribution, and review AGPL/GPL/MPL obligations before importing code. A repository with no LICENSE is reference-only unless permission is granted. Do not copy proprietary services, branding, content, credential-gated APIs, anti-cheat bypasses, or private assets. The preferred method is *documented interoperable formats plus independently written components*.

## Status

- **Added in this branch:** curated repository catalog, integration plan, and additive v1 schema/adapter.
- **Not completed:** dependencies integrated, reverse engineering of proprietary formats, PDF ingestion, visual game components, authentication, cloud storage, FSRS integration, security repair, runtime tests.


## Round 2 — Additional game engines and interoperability leads (2026-10-21)

These **12 new candidates** extend the existing inventory. Links lead to independent projects or alternatives, not verified decompilations of any proprietary app. Claims below are based on project descriptions; source code, licenses, dependencies, and current maintenance need inspection before adoption.

| Repository | Proposed technical value | Adaptation risk |
|---|---|---|
| [Lawndlwd/quizz](https://github.com/Lawndlwd/quizz) | Server-controlled timers, game recovery, persistent sessions and scoring settings | Medium/high: auth, data persistence, architecture |
| [virgilvox/doot-games](https://github.com/virgilvox/doot-games) | Declarative mini-game plugins, room lifecycle, party-game building blocks | Medium/high: architecture and licensing |
| [arvindfroi/quizparty](https://github.com/arvindfroi/quizparty) | WebRTC host-as-server design, shareable quiz JSON, QR/PIN joining | Medium: peer authentication, host reliability |
| [Congmoow/QuestPilot](https://github.com/Congmoow/QuestPilot) | Question bank search, wrong-answer notebooks, CSV/JSON/TOML imports | Medium: desktop-to-web portability |
| [ecamodeo/qti-builder](https://github.com/ecamodeo/qti-builder) | QTI 2.1 import/export representation including matching and ordering | Medium: target compatibility validation |
| [OpenQuester/OpenQuester](https://github.com/OpenQuester/OpenQuester) | Quiz packages, buzzer/wager/secret question game modes | Medium: custom format conversion |
| [mholzi/quizify](https://github.com/mholzi/quizify) | QR joins, phone buzzer, local-first party quiz and power-ups | Medium: Home Assistant specialization |
| [asaf-shitrit/openpartygames](https://github.com/asaf-shitrit/openpartygames) | Shared-screen/phone-only hosting, versioned content packs | High: AGPL-3.0, Cloudflare-specific backend |
| [donebd/SIGame](https://github.com/donebd/SIGame) | Offline quiz package engine and .siq import reference | Medium: package format and trust boundary |
| [yohurokano/openquiz](https://github.com/yohurokano/openquiz) | React/Express/Socket.IO question types and classroom play | Medium: rewrite Socket.IO to ws or adapter |
| [kylejckson/NanoQuiz](https://github.com/kylejckson/NanoQuiz) | Compact JSON quiz format and straightforward host/join flow | Low/medium: educational reference |
| [Mezee/cast-party-quiz](https://github.com/Mezee/cast-party-quiz) | Chromecast and phone-as-buzzer TV game architecture | Medium/high: streaming setup |
| [abhijatchaturvedi/gamenight](https://github.com/abhijatchaturvedi/gamenight) | Multi-mode room settings, quiz timing, drawing games | Medium/high: external trivia API and game rules |

**Correction:** this round contains **13** repository references in the table. With the previous 29 (including questgen), 18 additions, and this round of 13, the catalog contains **60 unique candidate links** before separately counting the official Anki codebase. Counts describe research leads, not validated working integrations.

### Specific integration experiments

1. **QTI bridge prototype:** create a specification of what Trivia Lobby can faithfully represent (multiple choice, multiple select, matching, short answer) and a per-format loss report. Do not import XML or ZIP without limits, path traversal defense, and entity-expansion prevention.
2. **Wrong-answer notebook:** extract wrong responses from local practice events into per-user review queues; verify stable question IDs and user authorization.
3. **Mini-game extension API:** define a server-authoritative game mode interface with lifecycle (create, join, start, submit, reveal, finish), capabilities and versioning. Do not load arbitrary external game code at runtime.
4. **Game identity hardening:** prioritize reconnect token verification before following peer-to-peer or extended lobby implementations.
5. **Export adapters:** prototype user-owned JSON and QTI output with round-trip tests; avoid undocumented scraping endpoints.

### Code and reverse-engineering provenance

- Independently recreated applications are not necessarily reverse engineered; do not categorize them as decompilations.
- `.siq`, QTI, APKG and supported interchange formats should be researched through published format descriptions or independently obtained legitimate example files.
- For each candidate, record its **commit hash, SPDX license, dependency advisories, project activity, source files examined, tests performed, and whether code is permitted to be copied**.
- Treat unknown licensing as reference-only. Even when a license is permissive, copying branding, characters, logos or proprietary question banks is not approved.



## Round 3 — QTI ecosystems and exam construction (2026-10-21)

Ten additional GitHub repositories were checked as existing via repository search. These are **research references only**; no third-party code or binary was copied, and feature claims have not been runtime-tested. For each integration, verify LICENSE at the specific commit and validate against representative exports. None of these are asserted to be leaked or decompiled commercial products.

| New repository | Capability worth inspecting | Fit and cautions |
|---|---|---|
| [LongsightGroup/qti3](https://github.com/LongsightGroup/qti3) | Framework-neutral TypeScript QTI 3 parsing, scoring, rendering, test fixtures | **High:** a modern TypeScript reference for interoperability; check exact spec profile and API stability |
| [collinsherriff/openassess](https://github.com/collinsherriff/openassess) | Local browser question bank, PDF-to-QTI, QTI/Moodle/GIFT/Aiken/CSV conversion | **High:** privacy-preserving import UX; PDF extraction accuracy and loss reports need testing |
| [tchajed/question-bank](https://github.com/tchajed/question-bank) | Source-controlled TOML questions, course exams and QTI export | **High:** question versioning and repeatable exports; distinct Go/CLI architecture |
| [atomicjolt/OpenAssessments](https://github.com/atomicjolt/OpenAssessments) | Older edX XML/QTI quiz engine | Medium: Rails/PostgreSQL architecture and legacy dependency maintenance |
| [gpoore/text2qti](https://github.com/gpoore/text2qti) | Markdown-ish text to QTI Canvas quizzes with feedback and answer keys | **High:** simple manual import path for college materials; verify syntax edge cases |
| [examplary/qti](https://github.com/examplary/qti) | TypeScript parsing and generation for QTI 2.1/3.0 packages | **High:** adapter candidate; test round-trip fidelity and manifest safety |
| [agencyenterprise/qti-3-player](https://github.com/agencyenterprise/qti-3-player) | Front-end QTI 3 XML rendering | Medium: project documents partial expressions and no adaptive behavior |
| [bobb34/QST](https://github.com/bobb34/QST) | Assessment, gradebook, Moodle XML and multiple QTI versions | Medium: broad assessment workflows; much larger stack |
| [hugobarragon/react-quizzes](https://github.com/hugobarragon/react-quizzes) | React quiz builder with drag/drop ordering and rich-text questions | Medium: assess maintenance, accessible controls and React 18 fit |
| [kaganlove/QTI-Converter](https://github.com/kaganlove/QTI-Converter) | Aiken/text to Canvas QTI question banks | Medium: focused export workflow; validate generated packages |

**Catalog tally:** 29 original linked references (including questgen) + 18 round-1 additions + 13 round-2 additions + 10 round-3 additions = **70 catalog references**, excluding the separately cited official Anki repository. This tally is not a count of audited, integrated or production-ready packages.

### Highest-value code experiments (not implemented in this branch)

- Establish **QTI conformance fixture tests** for our `shared/universal-questions.ts` answer variants using public fixtures from qti3.
- Build a strict **QTI package parser** with ZIP entry quotas, XML entity protection, no filesystem traversal, and loss reporting for unsupported question interactions.
- Add **Aiken and Markdown import previews** based on text2qti format conventions; preserve answer rationale and explicit answer validation.
- Prototype a **printable exam/answer-key exporter** from normalized questions; avoid leaking the answer key to student/game-player payloads.
- Make **source ownership and licensing** visible in the import screen; don't import teacher/student private material before access control exists.
- Keep the existing React/Express/PostgreSQL runtime, adding format adapters rather than transplanting entire LMS applications.

### Research sources
- [qti3 documentation](https://github.com/LongsightGroup/qti3)
- [OpenAssess documentation](https://github.com/collinsherriff/openassess)
- [text2qti examples](https://github.com/gpoore/text2qti)
- [examplary QTI package](https://github.com/examplary/qti)
