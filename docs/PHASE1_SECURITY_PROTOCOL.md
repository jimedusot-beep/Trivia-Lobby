# Phase 1: secure multiplayer wire protocol

## Deployment / compatibility
- Protocol version `v: 1` is required in every WebSocket message.
- This is a breaking change to the **old WebSocket protocol**, not to saved decks.
- Use the same deployment version for frontend and backend; refresh existing tabs.
- Room state and credentials are currently **in memory**. A server restart discards live games.
- The service currently has **no accounts or private deck authorization**. Existing deck APIs remain publicly readable and writable. Do not deploy with confidential decks or student content.
- Connection credentials are bearer secrets; the browser stores the player secret in localStorage and the host secret in sessionStorage. Serve over HTTPS/WSS only on public networks; never log/share these tokens.
- Do not treat browser session storage as a replacement for owner accounts, CSRF protections and database-backed permissions.
- Room code is for convenience only. Possessing a room code is **not** host or player authentication.

## Client → server
All messages have shape `{ "v": 1, "type": "...", "payload": { ... } }`.
- `create_room`: `{deckId:number}`; receives `room_created` with `roomCode` and `hostToken`.
- `join_room`: `{roomCode:string,playerName:string}`; receives `room_joined` with `playerId` UUID and secret `token`, then `sync_snapshot`.
- `rejoin_room`: `{roomCode,playerId,token}`. Requires server-issued token; rotates it on success.
- `resume_host`: `{roomCode,hostToken}`. Requires server-issued host token; rotates it on success.
- `start_game`: `{roomCode?}`. Host only, from lobby and with players.
- `next_question`: `{roomCode?}`. Host only. In reveal opens leaderboard; in leaderboard opens next question or finishes.
- `submit_answer`: `{roomCode?,questionIndex:number,answer:"A"|"B"|"C"|"D"}`. Players only. Scores one timely answer per question.

## Server → client
- `room_created`, `host_resumed`, `room_joined`: include credentials **only for the authenticated recipient**.
- `sync_snapshot`: includes lobby, phase, safe player list, and currently visible question. Only after reveal does it include the correct letter.
- `lobby_update`: public fields `playerId,name,score,connected`.
- `game_started`: empty payload.
- `question_start`: `questionIndex,prompt,choices,timeLimitMs,serverStartTs,deadlineTs`. No key, explanation or internal card fields.
- `answer_result`: after a server-timed or all-submitted reveal: `questionIndex,correctLetter,isCorrect,awarded`. The host gets `isCorrect:null`.
- `leaderboard` and `game_over`: sanitized player list only.
- `error`: safe user-facing message.

## State transitions and security
`lobby → playing → reveal → leaderboard → playing / finished`.
- The server sets deadlines and scores, never accepts client timestamps or player IDs as authorities.
- Questions are filtered to saved four-choice multiple-choice cards; other deck content remains intact for solo study.
- Answer results are concealed until reveal. A duplicate answer is rejected and scores once.
- Maximum WebSocket payload: 4096 bytes; max 40 messages per socket per 10 seconds, 5 room creations per IP per minute, 100 players per room.
- Room codes use the Node cryptographic RNG with collision checks. Host/player credentials are random 256-bit tokens stored hashed on the server.
- Clients can reconnect after a dropped socket while a room is active; old sessions are invalidated.
- The game engine is single-process. Multi-instance deployments need shared state or sticky routing with expiry.
- Room cleanup is best effort; abandoned hosts cause rooms to expire after 10 minutes of inactivity. Timed server-side reveal is automatic.

## PostgreSQL
Run a backup, then `migrations/phase1_cards_fk.sql` in your normal deployment process. It fails instead of deleting orphan cards if existing data violates the new FK. The Drizzle schema now declares the same CASCADE FK and index. Deck delete is performed in a transaction (cascade also handles future deletes).

## Tests
`npm ci && npm run check && npm run test && npm run build`. The `tests/phase1-multiplayer.test.ts` suite boots a real WebSocket server with an injected storage fixture, no PostgreSQL needed.
A separate PostgreSQL integration run is still required to verify migration, import rollback, concurrent edits, and deployed backups.

## Known limitations / Phase 1 acceptance gates
- **Critical: account authorization is not implemented**; current deck CRUD is public. Do not call the deck library private.
- No durable game session store, distributed locking, persistent reconnect credentials, or shared multi-instance scheduler.
- Reconnect secrets are browser-stored bearer tokens; XSS compromises them.
- No Playwright cross-browser E2E has yet been verified.
- Need verified CI evidence and real PostgreSQL migration/rollback test before declaring production readiness.
- External repositories in research docs are reference leads, not imported source. No third-party cloned code used in this implementation.
