# Learning-game open-source and AI reconstruction research

Research inventory recorded 2026-10-21. This is a **reference catalog**, not vendored source code, a statement of interoperability, or proof that every feature works. Links and license claims require a fresh review at the exact commit before using third-party code.

## Evidence key
- **Source project:** an independently built app, clone, or alternative; not proof of reverse engineering.
- **AI claim:** author or external write-up claims an AI-assisted workflow; authorship and full method not independently audited.
- **Reconstruction tool:** assists observation, documentation, or rebuilding; not evidence its author cloned any named learning game.
- **Unverified:** existence, license, buildability, advertised features, or provenance needs verification.

## Existing platform-inspired projects (28 references)

| Platform | Project | Research target | Evidence |
|---|---|---|---|
| Knowt / Quizlet | [t6c/study-deck-manager](https://github.com/t6c/study-deck-manager) | Sets, folders, persistence | Source project |
| Knowt | [git-ishaan-kumar/notes-to-flashcards](https://github.com/git-ishaan-kumar/notes-to-flashcards) | PDF/Word/text generation | Source project |
| Knowt | [mvcharcos/knowting](https://github.com/mvcharcos/knowting) | Course/source-linked studying | Source project |
| Knowt | [jarjk/crablit](https://github.com/jarjk/crablit) | Text imports and simple study loop | Source project; archived reported |
| Kahoot | [ethanbrimhall/kahoot-clone-nodejs](https://github.com/ethanbrimhall/kahoot-clone-nodejs) | Rooms and simultaneous player flow | Source project |
| Kahoot | [soleilvermeil/open-kahoot](https://github.com/soleilvermeil/open-kahoot) | WebSocket synchronization and hosts | Source project |
| Kahoot | [rotemtam/kahootClone](https://github.com/rotemtam/kahootClone) | Firebase/Angular game architecture | Source project |
| Duolingo | [sanidhyy/duolingo-clone](https://github.com/sanidhyy/duolingo-clone) | Paths, XP, hearts and quests | Source project |
| Duolingo | [bryanjenningz/react-duolingo](https://github.com/bryanjenningz/react-duolingo) | Frontend structure | Source project |
| Duolingo | [Saaswati/Duolingo-clone](https://github.com/Saaswati/Duolingo-clone) | Exercise types and server grading | Source project |
| Quizlet | [fkozlicki/quizlet-clone](https://github.com/fkozlicki/quizlet-clone) | Modes, exports, folders | Source project |
| Quizlet | [quenti-io/quenti](https://github.com/quenti-io/quenti) | Mature study architecture | Source project |
| Quizlet | [JohnGrahn/LibreStudy](https://github.com/JohnGrahn/LibreStudy) | Testing and spaced repetition | Source project |
| NotebookLM | [lfnovo/open-notebook](https://github.com/lfnovo/open-notebook) | Sources, citations and notes | Source project |
| NotebookLM | [devyanshyadav/librenote-ai](https://github.com/devyanshyadav/librenote-ai) | Document quizzes, flashcards | Source project |
| NotebookLM | [tom1030507/OpenNotebookLM](https://github.com/tom1030507/OpenNotebookLM) | Ingest and saved retrieval | Source project |
| NotebookLM | [run-llama/notebookllama](https://github.com/run-llama/notebookllama) | Document-processing pipelines | Source project |
| Blooket | [TacoJack21/BetterBlooket](https://github.com/TacoJack21/BetterBlooket) | Themes, collections, statistics | Source project |
| Blooket | [marty-on-linux/Blooket-2.0](https://github.com/marty-on-linux/Blooket-2.0) | Alternate play modes | Source project |
| Blooket | [hackerman-101/blobkit](https://github.com/hackerman-101/blobkit) | AI-inspired early game prototype | Source project; AI provenance unverified |
| Gimkit | [s-tn/Gimkit-Clone](https://github.com/s-tn/Gimkit-Clone) | Shops, currency, upgrades | Source project; archived reported |
| Gimkit | [manjun-stuff/gimkit-clone](https://github.com/manjun-stuff/gimkit-clone) | WebAssembly quiz gameplay | Source project |
| Anki | [YibinLong/Memochi](https://github.com/YibinLong/Memochi) | Scheduling, deck hierarchy, .apkg | Source project |
| Anki | [Le0nX/anki-clone](https://github.com/Le0nX/anki-clone) | Native mobile model | Source project |
| Anki | [BrokenMesh/AnkiClone](https://github.com/BrokenMesh/AnkiClone) | Minimal flashcard model | Source project |
| Quizizz | [LNMCode/MQChoice-Quizizz-clone](https://github.com/LNMCode/MQChoice-Quizizz-clone) | Multiplayer assessments | Source project |
| Quizizz | [stevenjr-yt/Quiz-Platform](https://github.com/stevenjr-yt/Quiz-Platform) | Host panel and live rooms | Source project |
| Quizizz | [csivitu/quizizzclone](https://github.com/csivitu/quizizzclone) | Timers and question editing | Source project |

Additional question-transfer reference: [kilroyjones/questgen](https://github.com/kilroyjones/questgen) (not a Gimkit clone).

## AI-assisted creator leads — claims, not verified reverse-engineering case studies

| Creator / project | Reported AI connection | Evidence boundary | Link |
|---|---|---|---|
| Antonio Erdeljac / Lingo | A third-party project listing reports Cursor and Claude Code | AI coding reported; proprietary source reconstruction not demonstrated | [write-up](https://vibecodedapps.vercel.app/apps/lingo/), [creator](https://github.com/AntonioErdeljac) |
| SivaSoorya G.R. / quiz | Repository reportedly credits Claude Code and Claude models | Author credit; do not infer that Kahoot was decompiled | [repository](https://github.com/andreegington/quiz) |
| Adam Bradford / Splycr | Creator describes vibe coding educational game variants | Public product/creator statement; open-source availability not established | [product](https://www.splycr.com), [creator post](https://www.linkedin.com/posts/adam-bradford-543508252_vibecoding-edtech-splycr-activity-7451292726764941313-UXaJ) |
| WillDev12 / FlashBuddy | Developer reportedly describes use of Claude | Requires confirmation in primary project source | [repository](https://github.com/WillDev12/FlashBuddy) |
| davidszp / notebooklm-mcp | Author reportedly credits AI assistants | Unofficial integration does not establish permission to reproduce vendor internals | [repository](https://github.com/davidszp/notebooklm-mcp) |
| tonykipkemboi / CrewAI NotebookLM Clone | Implements an agent-oriented NotebookLM-like workflow | Using AI libraries is not proof of AI-generated code or reverse engineering | [repository](https://github.com/tonykipkemboi/CrewAI-NotebookLM-Clone-Demo) |
| adrianhajdin / Lingua | AI voice features | AI functionality does not establish AI-assisted development | [repository](https://github.com/adrianhajdin/react-native-lingua) |

## Reconstruction and analysis tool leads (evaluate in sandbox)

| Tool | Proposed purpose | Caution |
|---|---|---|
| [greekr4/rever-browser](https://github.com/greekr4/rever-browser) | Browser/interaction/network inspection | Only inspect apps and sessions you are authorized to analyze |
| [jongko54/webEmbedding](https://github.com/jongko54/webEmbedding) | UI states, screenshots, comparison | Visual parity is not functional parity |
| [JCodesMore/ai-website-cloner-template](https://github.com/JCodesMore/ai-website-cloner-template) | Agent-guided component planning | Avoid copying distinctive protected artwork and branding |
| [luigiluft/ditto](https://github.com/luigiluft/ditto) | Layout and interaction documentation | Treat external designs as inspiration, not reusable assets |
| [mikulgohil/Morph](https://github.com/mikulgohil/Morph) | CLI-assisted reconstruction workflows | Verify scope and sandbox execution |
| [tentenco/ai-website-clone](https://github.com/tentenco/ai-website-clone) | Iterative interface reconstruction | Check provenance and license before execution |

## Nine-platform evidence gaps

No verified example in this research establishes use of a dedicated reverse-engineering agent to recreate **Knowt, Kahoot, Duolingo, Quizlet, Blooket, Gimkit, Anki, or Quizizz**. For NotebookLM, an unofficial integration is documented as a lead, but lawful scope and methods still need inspection. Do not promote conjecture to confirmed engineering history.

## Research validation checklist

For every candidate before adoption:
1. Resolve repository URL, default branch, latest commit and license file.
2. Read README **and source**; trace a working implementation, not screenshots alone.
3. Reproduce install, typecheck/build and tests in an isolated environment.
4. Check active maintenance, security posture, dependency/license compatibility, and reuse rights.
5. Record which claims come from author, third party, code inspection, or running tests.
6. Copy no code or assets until licensing and provenance are established.
7. Map the concept to an original Trivia Lobby implementation with acceptance tests.

**No third-party code has been imported by this catalog.**
