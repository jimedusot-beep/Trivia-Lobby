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
| `content.js`                        | Five original quiz questions and eight original creative prompts                               |\n| `custom-quiz.js`                    | Strict server-side guest-authored quiz validation                                             |\n| `public/guest-decks.js`             | Versioned browser-local IndexedDB quiz storage; import/export validation                      |\n| `public/create.html`, `create.js`    | Create, edit, reorder, import, export and host own quizzes without sign-in                    |
| `public/index.html`                 | Accessible host/player page structure                                                          |
| `public/app.js`                     | Browser connection, acknowledgment/reconnect handling and interface                            |
| `public/style.css`                  | Responsive mobile styling                                                                      |
| `test/contracts.test.js`            | Timer races, message validation, session ownership and projection isolation                    |
| `test/engine.test.js`               | Deterministic clock, scoring, privacy and transition tests                                     |
| `test/server.test.js`               | Real HTTP and WebSocket multi-client integration                                               |
| `package.json`, `package-lock.json` | Standalone dependencies and startup scripts                                                    |

## Local startup (Step 6)

Install Node.js 22 or newer and Git first. Use a new directory to avoid altering an existing checkout:

```sh
git clone --branch feature/guest-party-engine https://github.com/jimedusot-beep/Trivia-Lobby.git Trivia-Lobby-party-demo
cd Trivia-Lobby-party-demo/examples/party-engine
npm ci
npm test
npm start
```

Open **http://localhost:3001** and click **Create host screen**. Open three separate player tabs at the same address, or use three phones with the LAN command below. Enter the displayed code and a different nickname in each. The host display does not count as a player. All players need to reach the same running server.

To play on phones on your own Wi-Fi, stop the server with Ctrl+C and run:

```sh
HOST=0.0.0.0 PORT=3001 npm start
```

Open `http://YOUR-COMPUTER-LAN-IP:3001` on the host and phones; replace the IP with your computer's actual LAN address. Permit port 3001 through your local firewall if needed. Use the join link shown on the host screen. Windows PowerShell: set `$env:HOST="0.0.0.0"` and `$env:PORT="3001"` before `npm start`.

For a VPS, the same clone/install/start commands work with Node 22+. The default listens on loopback. With an existing HTTPS reverse proxy and a real domain, start the backend with:

```sh
PUBLIC_ORIGIN=https://party.example.com HOST=127.0.0.1 PORT=3001 npm start
```

Replace the example domain. Forward that HTTPS origin to port 3001, including WebSocket upgrades for `/socket`; retain the original Host header. `PUBLIC_ORIGIN` must exactly match the browser origin, without a trailing slash. Keep it running with your VPS process manager. This is a startup example, not an automatic deployment or domain/TLS provisioning script.

## Rules

- 3–8 connected players, nickname only. One six-character code survives successive matches.
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
