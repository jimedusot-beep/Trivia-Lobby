# Trivia Lobby: standalone guest party engine

Approved match flow implemented as a separate runnable example. It does not modify the existing Trivia Lobby app, accounts, database, private decks or document authorization. Its server exposes original public demo content plus bounded guest-authored quizzes for the lifetime of a room. It never reads authenticated private decks or documents.

## Files (Step 5)

| File                                | Responsibility                                                                                 |
| ----------------------------------- | ---------------------------------------------------------------------------------------------- |
| `server.js`                         | HTTP/static hosting, WebSockets, credentials, origin checks, limits, heartbeat and room expiry |
| `protocol.js`                       | Strict connection/action schemas; rejects invented identity and stale-envelope fields          |
| `sessions.js`                       | Hashed reconnect credentials and current-socket ownership                                      |
| `scheduler.js`                      | Per-party cancellable deadlines, replacement and shutdown lifecycle                            |
| `projections.js`                    | Explicit public host/player views and hidden-answer/author boundaries                          |
| `engine.js`                         | Authoritative phases, deadlines, submissions, voting, scoring and player-specific views        |
| `charades.js`                       | Original guessing packs, shuffle, mark history and exhaustion                                  |
| `content.js`                        | Five original quiz questions and eight original creative prompts                               |\n| `custom-quiz.js`                    | Strict server-side guest-authored quiz validation                                             |\n| `public/guest-decks.js`             | Versioned browser-local IndexedDB quiz storage; import/export validation                      |\n| `public/create.html`, `create.js`    | Create, edit, reorder, import, export and host own quizzes without sign-in                    |\n| `public/practice.html`, `practice.js` | Play solo practice with feedback using own device-local quiz                             |
| `public/index.html`                 | Accessible host/player page structure                                                          |
| `public/app.js`                     | Browser connection, acknowledgment/reconnect handling and interface                            |
| `public/style.css`                  | Responsive mobile styling                                                                      |
| `test/contracts.test.js`            | Timer races, message validation, session ownership and projection isolation                    |
| `test/engine.test.js`               | Deterministic clock, scoring, privacy and transition tests                                     |
| `test/server.test.js`               | Real HTTP and WebSocket multi-client integration                                               |
| `package.json`, `package-lock.json` | Standalone dependencies and startup scripts                                                    |

## Run a full family game night on your own Wi-Fi

**Use the current `main` branch, not the retired guest-party feature branch.**
The maintained, beginner-friendly [Windows laptop and Raspberry Pi LAN setup guide](../../docs/LOCAL_WIFI_GAME_NIGHT.md) explains the QR join link, private LAN address, firewall, reconnects, shutdown, updates and physical 20-phone test checklist.

Quick start (Node.js 22+ and Git required):

```sh
git clone --branch main https://github.com/jimedusot-beep/Trivia-Lobby.git
cd Trivia-Lobby/examples/party-engine
npm ci
npm test
npm start
```

By default the server listens on loopback (`http://localhost:3001`). To host phones on the same home Wi-Fi, use `HOST=0.0.0.0 PORT=3001 npm start` on Linux/Raspberry Pi, or PowerShell environment variables on Windows as described in the guide. Open the host using its **LAN IP address** (for example `http://192.168.1.27:3001`) before showing the QR code so phones do not receive a non-working `localhost` link.

Guest rooms and the room championship are in-memory. A server restart loses the room; Render deployment is independent of this LAN server.

## Six more family party modes (stacked PR)

Selected by the owner: Guess the Percentage, Category Clash, Family Bingo, Caption Chaos, Timeline Tangle, Bracket Battle. All six reuse the existing QR guest lobby and 3–20 participant limit. They have original starter content and server-controlled points, private player projections, room timers and reconnect semantics. For exact rules, answer-bank limitations, timeout rules and acceptance gates see [SIX_GAMES.md](docs/SIX_GAMES.md). The six-game PR is based on the five-game PR below and **neither is live until reviewed, merged and deployed**.

## Five additional social games (new feature PR)

Games reuse the existing six-character room code and host/player credentials; a same-origin SVG QR invitation is shown in the integrated main app. Each room supports **3–20 connected guests**. Original Quiz, Prompt Duel and Charades remain available, including expanded twenty-person Prompt Duel prompts. All five social packs contain five original rounds (35 seconds for choices, guesses and survey answers; 45-second clue submission plus 35-second suspect voting in Secret Impostor):

- **Majority Rules:** all answers are hidden until reveal. Matching the most popular of two choices earns 100 points; both groups score if tied.
- **Who's Most Likely?:** each guest nominates another current player. Choosing any most-nominated player earns 100 points; self-votes and forged IDs are rejected.
- **Closest Wins:** each person enters a safe whole number (0–1,000,000). Every tied closest player earns 100, with the answer shown only after the round ends.
- **Survey Showdown:** guests type one answer. Five original ranked answers give 100/80/60/40/20 points, with exact case-insensitive punctuation-normalized comparison; unmatched or misspelled responses score zero. The list is an editorial game pack, *not* a claim about a real poll.
- **Secret Impostor:** one player is randomly designated impostor each round. Other players privately receive a word, while the impostor sees only a category. Everyone submits one short clue; then clues become visible and players vote for someone other than themselves. Each correct suspect vote earns 100; the impostor earns 200 if at most a quarter of received votes identify them. Secret word and impostor identity appear on reveal.

Request IDs are idempotent and bound to the socket's credentialed actor; duplicate, stale, out-of-range or post-deadline submissions cannot mint points. No raw submitted survey responses are broadcast. Impostor clues are guest-authored, so hosts should play with trusted family members and supervise nicknames. Guest rooms are process-local and do not persist through free-tier restarts. The new modes do not read private study/account data.

## Rules

- 3–20 connected players, nickname only. One six-character code survives successive matches.
- Quiz: five demo questions **or 1–20 validated local custom questions**, 30 seconds each, first valid answer locked; 100 points per correct answer and no speed bonus. All answers or the deadline ends a question; reveal occurs once.
- Charades: select Actions or Animals; each participant acts once for up to 60 seconds after a three-second countdown. Only the performer sees the active clue. Correct adds one point; Pass adds none. Marks require group agreement and are self-reported. The round ends at the deadline or deck exhaustion; the turn summary reveals completed/pass/unanswered clues. No motion permission is needed.
- Prompt Duel: one paired prompt per player, two assignments per player, 90 seconds to write. Responses lock on submission. Each matchup has 20 seconds for eligible players to vote; neither author may vote. Every valid vote gives its chosen author 100 points. Missing-response matchups skip without points. Identical response text still has distinct choice IDs.
- The host advances after reveal and returns to the same lobby after the final result. Ties remain ties. Scores reset when the next match starts.
- Timers continue through player disconnects. A disconnected host may resume during timed play; after the active phase closes there is a 60-second host grace period. Expiry marks the match interrupted. No automatic promotion based on nickname.
- Server receipt/phase state decides eligibility; no client timestamp is accepted as proof. Request IDs permit acknowledgment retries without scoring twice. Reconnect uses a secret credential, not the code or nickname alone.

## Storage and operational limits

Custom quiz questions are saved only on the creator's browser until they choose to host. Creating a room sends that validated quiz to the server **in memory** so it can score other participants' answers. Its answer key is not disclosed to players before reveal. Rooms are limited to 1–20 questions, 2–4 choices each and bounded title/question/answer lengths. No user source document or private cloud deck is accessed.\n\nParty state is held in one server process. A restart loses rooms; there is no database, cross-device account sync or multi-server room coordination in this example. Idle rooms expire after ten minutes. Guests' credentials and unsubmitted writing drafts use tab session storage; denied storage means a reload may lose reconnect access. Leaving the device ends its session; use a different tab to simulate another player. Do not share reconnect credentials.

The demo caps rooms, message sizes and action/connection rates and checks browser origins. Public deployment needs HTTPS, trusted proxy configuration, operational monitoring and deployment-specific abuse controls. No 100-player/load, screen-reader or physical-phone compatibility claim is made. These party scores never update study history or FSRS. The guest pages are now integrated at `/party/` and `/party/create.html` in the main app while remaining independently runnable here.

## Verification recorded for this delivery

Standalone `npm ci --ignore-scripts --no-audit --no-fund` succeeded; `npm test` passed all 27 tests with no skips. The real-server integration uses three WebSocket players and checks HTTP serving, hidden answer keys, scoring, a forged host credential and valid reconnection. Root TypeScript checking and browser-script/server syntax checks passed. Tests use short injected timings; default match durations remain 3/30/90/20 seconds.

Chromium was unavailable, and Playwright's browser download returned an invalid/truncated archive. No rendered browser, physical-phone, manual screen-reader or load verification was completed. This implementation is provided for local review and further integration, not described as a tested live deployment.

## Applying the Open-Kahoot architecture lessons

The design was informed by a focused source review of [Open-Kahoot at 929c810](https://github.com/soleilvermeil/open-kahoot/tree/929c810b2c12e2dcbca666137a0e13ad02ca5116/src/lib/game). This implementation uses original modules with separate protocol validation, credentials, scheduling and public projections. The existing WebSocket transport, match rules and scoring are retained.

The scheduler owns one pending phase/grace deadline per party. Replacing a deadline invalidates its previous callback; cancellation and shutdown also invalidate callbacks already queued by the event loop. Deadline checks still happen when an action arrives, so delayed wake-ups cannot accept late answers. Expired rooms cannot re-arm timers through closing sockets. Idle-room cleanup runs separately every five seconds.

Reconnect authenticates before attaching a replacement socket and evaluates elapsed deadlines before resuming the participant. A delayed close event from the old socket cannot disconnect its replacement. Real-socket tests cover writing, voting, reveal, stale matchup votes, a late answer arriving before its timer callback, and host grace expiry. Contract tests cover timer replacement/cancellation/self-rescheduling and accidental future private fields in player records. A failed start with fewer than three connected players now retains offline participants and their reconnect access.

Hardening checkpoint: 20 tests passed, no failures/skips. No new browser or physical-device verification was performed; the Chromium download limitation above remains. The changes are confined to this standalone example and do not integrate it into the existing deployed application.

## PDF-derived Charades and dedicated CI

[Extraction and decisions](../../docs/research/REA_PDF_EXTRACTION.md) record how the 44-page uploaded vault was evaluated, what is already covered, which original feature was implemented, and what remains a future assignment. No unvalidated snippet is substituted for the current authorization/scoring logic.

To run the new browser scenarios after installation:

```sh
npx playwright install chromium
npm run test:browser
```

`npm test` continues to run the deterministic and real-socket suite without a browser. The dedicated Guest party engine workflow installs Chromium and runs the browser scenarios on GitHub; local discovery alone is not a passing browser result. The suite uses mobile-sized browser viewports and does not verify physical device sensors. Motion controls remain deferred.

PDF-extraction delivery: the current standalone suite passes 27 tests with no failures or skips. All three Chromium scenarios are discoverable; local browser execution still requires the missing Chromium binary.

The three browser cases were attempted locally and all were blocked at browser launch by the missing Chromium executable; they are not included in the 27 passing server/engine tests.

Hosted CI resolved the browser gate for implementation commit `b9dc1c`: [Guest party engine run](https://github.com/jimedusot-beep/Trivia-Lobby/actions/runs/40193016168) passed all **27 engine/server tests and 3 Chromium scenarios** (28.0 seconds for browser scenarios). This covers rendered Quiz, Prompt Duel and a complete three-player Charades rotation, including mobile-sized viewports. It does not certify physical devices, motion sensors or manual screen-reader behavior.

## Main-app integration

The main application now mounts the same guest engine at `/party/` on its existing HTTP port. The sign-in screen, signed-in navigation and home page link to it. Invite URLs retain `/party/?code=...`; guest credentials are scoped to the page path. The production build ships the page assets in `dist/party`. No second service or standalone dependency install is needed when running the main application.

`transport.js` owns the reusable guest socket handler; `server.js` remains the standalone launcher. `/party/socket`, the existing private-deck `/ws` transport and development HMR handle only their own upgrade paths. The guest route never reads private decks or account sessions. Set `PUBLIC_ORIGIN` to the exact external HTTPS origin behind a reverse proxy; without it the origin must be HTTP(S) with the incoming Host. Proxy WebSocket upgrades and retain Host. Rooms remain in memory and disappear on restart. This code change is not a deployment.

## Personal courses without an account

Open `learn.html` (`/party/learn.html` in the main app), or choose **Save & learn**
in the quiz creator. Use HTTPS or localhost for browser storage and course hashing.
Each quiz becomes an ordered course with lessons of up to five questions. Earlier
lessons unlock later ones; completed lessons remain available for replay. Missed
questions return once after the first pass, with answer explanations. Refresh and
choose **Resume** to return to the saved prompt or feedback.

The first completion of a versioned lesson earns 5 XP plus 10 for each first-pass
correct answer. A replay can improve its displayed best score and count toward
today's goal, but does not earn additional XP. Every 100 XP adds a level. Finish
one lesson per day for the optional daily goal; streaks use the timezone saved
when learning begins. A break preserves the best streak and achievements. These
are local participation milestones, not a mastery rating or competitive score.

Changing quiz questions starts a fresh path for that version while keeping earlier
XP and achievements. Renaming a quiz keeps its path. The local learning store is
separate from the quiz store and private cloud data. Failed or corrupt progress
storage displays a session-only warning and leaves saved records intact.

**Download learning backup** includes the local quizzes, answer keys and completed
learning progress in plain JSON. It does not include unfinished answer sessions.
Restore it on another device or after clearing browser data. Imports are bounded,
validated, merged without removing milestones, and refuse to overwrite a different
quiz with the same ID. Quiz and progress restoration use separate transactions;
an error explicitly says if quizzes were added but progress could not be saved.
The original quiz-maker JSON backup remains supported separately.

See [the focused specification](../../docs/GUEST_LEARNING_PATH.md) for limits and
acceptance checks. The guest workflow runs the learning unit and browser scenarios;
the main-app workflow also verifies public integration and accessibility in all
three supported browser engines. Historical verification counts above describe
their original deliveries, not this change.

## Integrated open game pack

Ten new account-free modes now share the same engine, code, QR invitation and reconnect credentials: Family Showdown, Doodle Dash, Color Clash, Four in a Row, Chess Club, Checkers Chase, Reversi Rivals, Mancala Match, Card & Dice Table and Backgammon Table. See [implementation and acceptance](../../docs/OPEN_GAME_PACK.md) and [pinned source/reuse scope](../../docs/OPEN_GAME_SOURCES.json). `show.html` creates/imports original showdown packs; `create.html` imports supported Razzia single-answer files. These adaptations do not embed the upstream applications or their entire catalogs.

The new pack is AGPL-3.0-or-later with retained component notices. `npm start` generates `public/open-source` from the exact checked-out source; the integrated production build does the same. No generated source snapshot or private environment data is committed. The Credits & Source link exposes notices and corresponding guest source.
