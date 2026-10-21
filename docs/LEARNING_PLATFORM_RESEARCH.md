# Learning-platform source research and integration catalog

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
