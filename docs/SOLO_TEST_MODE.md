# Solo Test Mode — one tab, real multiplayer rules

This document describes the **31-game feature branch in PR #119**, not a promise that all 31 modes are already deployed. The existing production Solo Test supports the original three automatic-rival modes. Do not merge or deploy this draft until the current branch's cross-browser checks and release review pass.

## Start

Open /party/solo-test.html and choose one of the 31 game titles. The selector reads their names, IDs and minimum player counts directly from guestGames, rather than maintaining another application catalog. Start a test room with 2–5 ordinary guest seats (respecting each selected game's minimum), using the same game engine and WebSocket rules as a normal room.

## Two different testing experiences

- **Automatic rivals — Trivia Quiz, Party Grand Prix and Tap Dash:** the existing simulator creates real WebSocket-connected, server-scored rivals. It supplies quiz answers, bounded race inputs or taps; you control your own seat. The room and scoreboard are authoritative.
- **Manual test seats — the other 28 games:** one temporary host screen and 2–5 ordinary, separately authenticated guest controllers are embedded on one same-origin page. Use **Control a test player** to switch between seats and take each player's turn manually. The actual phone/host frontends run unmodified. These seats are **not AI opponents** and will not automatically cast votes, submit clues, draw, play cards or make chess moves.

For the manual-seat path, first select a title, then choose test seats, select Start solo test, wait for the real match to start, and switch between controllers as needed. Host-only actions such as judging, advancing and returning to the lobby remain on the host frame.

Sorry Ish is displayed under that title after synchronizing PR #119 with production main commit 9811221. Its internal mode ID remains homeward and its game rules are unchanged.

## Privacy and limits

- No privileged test bot or player-count bypass. The server validates every ordinary guest action, score, phase and role; guest secrets stay private to their view.
- Each embedded frame receives a fresh, nonpersisted solo-seat identity. The only embeddable pages have an explicit same-origin frame policy. Other normal party pages cannot be framed; third-party framing is prohibited.
- Selecting Stop tears down the test frames and their WebSocket connections. The temporary server room expires normally; it is not an offline sandbox or a persistent lobby.
- This uses the real party server. Do not use it during a live workplace event to measure user capacity.
- Automatic rivals and embedded sessions **do not** validate physical phone ergonomics, camera QR scanning, Wi-Fi handoff, motion sensors, latency or a 10–20-person event.

## Completion acceptance (separate from the game-selection smoke test)

A game is only **complete** for this audit when automated evidence demonstrates: (1) setup and start with legal player count; (2) real actor-authorized input; (3) score or board-state progression; (4) terminal winner/draw or full final leaderboard without repeated awards; (5) host Next/finish and return to the **same party**, preserving usable guest reconnection; and (6) no unrecoverable UI error. A mode may intentionally be *manual* (such as Whist or Backgammon) and should be labeled accordingly instead of called fully automated.

The new browser completion test exercises all these lifecycle steps for **Four in a Row**. Existing unit, WebSocket and browser tests cover many other individual rules and flows, but **31 game titles in the selector does not mean 31 independently verified complete browser matches**. Use GAMEPLAY_COMPLETION_MATRIX.md as the per-mode queue and record exact CI evidence before marking additional modes complete.

Existing browser tests additionally cover: all 31 selector entries; ordinary-page CSP versus embedded test seats; a Four in a Row legal-move/role-switching journey; six representative manual games (Duel, Majority, Family Showdown, Doodle Dash, Color Clash and Card & Dice Table); and the three automatic-rival scenarios.

## Release gate

Run root check/test/build, the standalone guest engine unit/socket suite, Chromium/Firefox/WebKit browser tests (including solo-all-games and solo-completion), all six required repository workflows, and a read-only verification of the exact live release. Review browser artifacts and actual phone/TV testing separately. Keep PR #119 draft and Render unchanged until a distinct approval to merge and deploy.
