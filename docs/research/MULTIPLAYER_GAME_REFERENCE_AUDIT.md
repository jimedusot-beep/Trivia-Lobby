# Trivia Lobby — Multiplayer and game-reference audit
**Research date:** 2026-10-21. Evaluated GitHub repository metadata, file trees, and selected source/README excerpts. No external source code has been copied. License labels reflect what GitHub's metadata reported on this date, not a substitute for legal review.

## Kahoot — lobby, host and scoring

### [ethanbrimhall/kahoot-clone-nodejs](https://github.com/ethanbrimhall/kahoot-clone-nodejs)
- **Files checked:** `server/server.js`, `server/utils/liveGames.js`, `server/utils/players.js`, `public/js/{hostGame,playerGame,quizCreator}.js`, and HTML host/player screens.
- **Implementation clues:** Node.js, Express, Socket.IO, MongoDB; tracks multiple live rooms with separate host and player views.
- **Use for Trivia Lobby:** isolated game-session state, reconnect-safe player ID, host-only controls, consistent question reveal timing, server scoring, and game cleanup.
- **Caveats:** very old dependencies; no license detected. Reference-only.

### [soleilvermeil/open-kahoot](https://github.com/soleilvermeil/open-kahoot)
- **Files checked:** `src/lib/game/QuestionManager.ts`, `src/lib/socket-{client,server,config}.ts`, `src/components/QuestionEditor.tsx`, `src/app/api/generate-questions/route.ts`.
- **Implementation clues:** Next.js + Socket.IO; QuestionManager separately computes progression, per-player results, answers, and leaderboard.
- **Use for Trivia Lobby:** separate `GameSession`, `QuestionEngine`, `RoomManager` and `Scoreboard` modules; authoritative scoring, sanitized events, AI generation as an optional process.
- **Caveats:** AGPL-3.0 license; don't copy into Trivia Lobby without adopting compatible obligations or securing another license.

### [rotemtam/kahootClone](https://github.com/rotemtam/kahootClone)
- **Files checked:** `app/scripts/controllers/{host,player}.js`, `app/scripts/services/{host,player,trivia}.js`, `app/scripts/routes.js`.
- **Implementation clues:** AngularJS and Firebase, simple MVC game responsibilities and synchronization.
- **Use for Trivia Lobby:** review the host/player separation concept, not the dated framework stack.
- **Caveats:** no license detected; old code and Firebase era make direct integration unsuitable.

## Blooket — playful modes and collections

### [TacoJack21/BetterBlooket](https://github.com/TacoJack21/BetterBlooket)
- **Files checked:** `src/App.jsx` routes `Stats`, `Blooks`, `Market`, `Discover`, `SetCreator`, `Sets`, `Favorites`, `Settings`, `src/context/AuthContext.jsx`.
- **Important verification:** `src/pages/dashboard/SetCreator.jsx` is a **placeholder** that literally renders “set creator”. Do not assume the project has a functioning question editor because the route exists.
- **Use for Trivia Lobby:** original collectibles, stats, favorites, custom quiz modes and library discovery, built independently.
- **Caveats:** GitHub license metadata is `NOASSERTION`; investigate exact license content before copying any code or assets. Avoid Blooket-like art.

### [marty-on-linux/Blooket-2.0](https://github.com/marty-on-linux/Blooket-2.0)
- **Files checked:** `server.js`, `package.json`, `Download this folder and run the .html inside/{index.html,questions.js}`, README.
- **Implementation clues:** small Node-served quiz game, custom question sets and multiple game mode aspirations.
- **Use for Trivia Lobby:** lightweight independent minigame plugins with one common card set.
- **Caveats:** tiny beta; no license detected despite broad README language about being “open source”. Reference only.

### [hackerman-101/blobkit](https://github.com/hackerman-101/blobkit)
- **Files checked:** `index.html`, `blook.html`, `market.html`, `stats.html`, `script.js`.
- **Implementation clues:** static HTML/JavaScript prototype with collection/market/points screens.
- **Use for Trivia Lobby:** optional original reward catalog and a cosmetic collection; no real-money features needed.
- **Caveats:** README calls it an AI-built beta; no license detected and potentially derivative visual identity. Do not use artwork or code.

## Gimkit — strategic quiz rewards

### [s-tn/Gimkit-Clone](https://github.com/s-tn/Gimkit-Clone)
- **Files checked:** `index.js`, `public/{shop,powerup,host,join,game}.js`, `games/*.json`.
- **Implementation clues:** Socket.IO room events, upgrades and game shops, with server event broadcasts.
- **Use for Trivia Lobby:** separate virtual reward balance from factual performance, make spending authoritative on the server, cap upgrades and test duplicate messages.
- **Caveats:** archived, no detected license; some game assets/fonts may have different rights. Reference only.

### [manjun-stuff/gimkit-clone](https://github.com/manjun-stuff/gimkit-clone)
- **Files checked:** `main.cpp`, `index.html`, `index.js`, `index.wasm`.
- **Implementation clues:** early C++/SDL/WebAssembly prototype with `QUESTIONS`, `SHOP`, and `GAME_END` states; coin count, movement and checkpoints.
- **Use for Trivia Lobby:** a game-mode state machine and an independent quiz/platformer mode. Keep platform-game engine separate from study services.
- **Caveats:** unlicensed beginner experiment; not a mature web multiplayer quiz engine.

## Wayground / Quizizz — classroom flow and assessment

### [LNMCode/MQChoice-Quizizz-clone](https://github.com/LNMCode/MQChoice-Quizizz-clone)
- **Files checked:** `Server/models/{Room,Question,Users}.js`, `Server/routes/{answer,joinroom,room}.js`, `WebApplication/MCQWeb/app/Http/Controllers/Host/`, Flutter/mobile sources.
- **Implementation clues:** separate host and player routes, multi-device quizzes, result notifications and question management.
- **Use for Trivia Lobby:** quiz authoring vs participation API boundaries, per-question stats, role-based host permissions.
- **Caveats:** no license detected, old complex multi-stack project. **The tree includes `Server/.env`**—do not fetch, copy or reuse any embedded credentials. Reference only.

### [stevenjr-yt/Quiz-Platform](https://github.com/stevenjr-yt/Quiz-Platform)
- **Files checked:** `backend/index.js`, `backend/db.js`, `frontend/src/pages/{Game,Join,TeacherDashboard}.jsx`, `frontend/src/components/Auth.jsx`.
- **Implementation clues:** React + Express/Socket.IO + SQL; host/teacher tools, player joining, database-backed quizzes.
- **Use for Trivia Lobby:** host dashboard, question editor, one-click public game joining and controlled authentication.
- **Caveats:** GitHub license status `NOASSERTION`, so do not lift code without checking terms; review claimed security rather than assuming it.

### [csivitu/quizizzclone](https://github.com/csivitu/quizizzclone)
- **Files checked:** `admin.html`, `admin-script.js`, `script.js`, `index.html`, README.
- **Implementation clues:** basic quiz creation and preview, several answer types, timers, draft storage in browser `localStorage`.
- **Use for Trivia Lobby:** quick independent quiz editor and preview, then save to PostgreSQL behind account authorization.
- **Caveats:** no license detected; `localStorage` is not reliable permanent cross-device storage; not proof of secure server accounts.

## Overall game-system integration plan

1. **Preserve current WebSocket implementation**, but audit its event protocol and test host-only start/next operations and player reconnects.
2. **Split game engine from transport:** `RoomManager` (join/leave/reconnect/cleanup), `QuestionEngine` (timing/answers), `ScoreEngine` (points/deduplication), `ModeRegistry` (classic/teams/shop).
3. **Reuse saved decks as the single truth.** Every mode consumes card IDs and a versioned question snapshot, not independent manual sets.
4. **Define authoritative state transitions:** lobby -> question -> results -> next question -> final scoreboard. Send only the minimum answer information to players after close.
5. **Add secure guardrails:** unpredictable room IDs, per-room admission limits, player name bounds, WS message validation, answer timing, no double submission, host ownership, dead-room cleanup, crash recovery policy.
6. **Build independent art and sounds.** Never copy brand names, third-party mascots, logos, images or sound effects.
7. **Avoid shipping live game claims until verified** by a multi-client end-to-end test suite on a backend with persistent database and stable WebSocket hosting.

## License and delivery boundary

No external source code, binary assets, or game data is bundled into Trivia Lobby by this research. The extraction delivers feature maps, module references, risks and original implementation direction. License terms must be checked again if individual modules are later considered for direct reuse. A public repo is not inherently an open-source licensed repo.
