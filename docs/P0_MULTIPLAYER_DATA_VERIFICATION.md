# P0 multiplayer and data migration / verification

This branch is a targeted security and multiplayer repair, **not** a claim that Trivia Lobby is safe for private student content yet. Authentication, ownership authorization, durable backups, and private file storage remain blockers to a public launch.

## Deploying the foreign-key change

The schema now enforces `cards.deck_id -> decks.id ON DELETE CASCADE` and deck deletion uses a transaction. Before applying the schema to any populated PostgreSQL instance:

1. Take and verify a database snapshot through the hosting provider.
2. Inspect existing orphaned cards:
   ```sql
   SELECT c.id, c.deck_id FROM cards AS c
   LEFT JOIN decks AS d ON d.id = c.deck_id
   WHERE d.id IS NULL;
   ```
3. Resolve any orphans **after review**, rather than silently deleting user content.
4. Run `npm run db:push` in a controlled maintenance window and validate the FK.
5. Rehearse restore from the snapshot in a separate database before rollout.

Existing deployments must apply this schema change; editing the Drizzle model alone does not migrate a live database. DB snapshots and retention schedules must be configured in the actual deployment provider; this repository cannot certify backups by itself.

## Server-authoritative match contract

- The host creates a room for a deck containing valid multiple-choice cards.
- Room codes are eight-character CSPRNG-generated codes, with collision checks and rate-limited guesses.
- Player joins use `{roomCode, playerName}`. The server returns `room_joined` with a UUID and 256-bit reconnect token.
- Only `rejoin_room` with both server-issued credentials can reclaim a player; the token rotates on reconnect.
- `question_start` includes `questionId`, `prompt`, `choices`, `timeLimitMs`, `serverStartTs` — no answer key.
- `submit_answer` includes `roomCode`, `questionId`, `answer`; duplicates, out-of-order answers, and missed deadlines are rejected.
- The round ends after all connected players answer, or when the server's 30-second timer expires.
- `answer_result` reveals the answer and sanitized rankings; the player's own response includes private correctness and points.
- Only the host can start and advance the match; only after a reveal can the host advance/finish.
- Disconnecting players can rejoin while the host room exists. Disconnecting the host closes the in-memory room (host reconnect and persistence are future work).

## Security and operational limitations

- **Critical:** HTTP deck read/create/import/card write/delete and hosting still require an account and ownership authorization layer. Do not serve confidential content until these are implemented.
- Game rooms are in memory and do not survive backend restarts or scale across multiple processes. A shared datastore/pubsub strategy is required for horizontal scaling.
- In-memory IP throttling is a single-process safeguard, not a distributed abuse control.
- Tokens are persisted in browser localStorage for match recovery; they should be treated as bearer secrets and protected from XSS. Future authenticated sessions should prefer appropriately scoped HttpOnly cookies.
- WebSocket maximum payload is 4 KiB; HTTP JSON size is 2 MiB. Align these limits with any reverse proxy.
- Sample deck seed is public demo data only.

## Regression commands

```sh
npm ci
npm run check
npm run test
npm run build
```

Manual multi-browser acceptance: host room, join with two players, answer one round, confirm no answer key in `question_start`, confirm private correct/points, submit twice and verify rejection, disconnect and rejoin one player with rotated credentials, verify old token rejected, then finish and inspect sanitized leaderboard. Verify late submissions are rejected. Confirm a second unauthorized browser cannot start or advance the room.
