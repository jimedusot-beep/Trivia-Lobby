# Multiplayer reliability

This implements networking/recovery ideas from the source research in Trivia Lobby's own code. Every existing game and both guest/private entry paths remain in place. No reference-project code or assets were imported and no hosting resources were provisioned or upgraded.

## Behavior

- Both transports save authoritative, private PostgreSQL checkpoints before releasing credentials, acknowledgments, scores or game snapshots. Database failures discard the prepared frames and disconnect affected clients for recovery from the last committed state.
- Recovery reconstructs the same room, match, roster, scores, private assignments, question deadline and accepted-request history. All restored socket bindings start offline. An elapsed deadline advances once; reconnecting cannot reset it or score the round again.
- A guest host that was healthy at its last checkpoint receives a fresh recovery grace period, even after a long idle lobby. An already established absence timestamp persists across subsequent restarts. Failed connection replacements disconnect both the old and new sockets so each affected phone can recover.
- Disconnected quiz participants remain eligible until the original deadline; the first returning phone cannot close the question for everyone else. The per-IP quiz resume budget allows repeated twenty-phone reconnects from one household.
- Optimistic checkpoint versions fence older writers. Versions are globally increasing, including when an expired room code is reused. Each payload is capped at 4 MiB, all active payloads at 32 MiB and active records at 700. Idle rooms expire after ten minutes. These are application payload budgets, not a guarantee about PostgreSQL's physical storage usage.
- Only credential hashes persist. Modern quiz resumes use a stable request ID so a lost rotated-token response can be replayed. The client confirms receipt of the new credential, which removes the previous-token replay receipt. Legacy quiz clients retain their original wire format and token rotation.
- New quiz commands carry request IDs and match/phase identity. Exact retries replay the acknowledgment and a current private snapshot. Changed requests using an old ID reject. The bounded replay history retains at most 256 requests per actor and 4096 per room. Answer, purchase, bonus and phase authorization remain server-controlled.
- Ordered lobby configuration edits share the lobby's phase revision, so rapid typing does not invalidate the next edit in flight. Modern hosts receive authoritative settings after configuration, retries and reconnects; the form reconciles with those saved values.
- Both transports detect stale/slow sockets. Browsers use capped exponential reconnect backoff with jitter, a liveness deadline, restored-connectivity/foreground handling and readiness only after authenticated room synchronization. Replaced sessions stop retrying. Recovering screens provide a route back to joining or owned decks.
- Pending quiz report rows are part of the checkpoint and replay into the existing idempotent report sink after a restart. Private checkpoints have no HTTP export route.

## Deployment

The normal production launcher applies additive `0009_live_room_checkpoints.sql`; the application passes the existing PostgreSQL pool to both transports. Use `npm run db:migrate` before local development. Do not replace this with `db:push`, because the migration also installs the atomic save function.

The SQL function commits each checkpoint in one database round trip and serializes budget/fencing checks with a transaction advisory lock. A stale writer is disconnected rather than silently overwriting the winning checkpoint. No Redis, additional database or paid service is required.

Checkpoint format version 1 is internal. Bump/explicitly migrate it when a future engine/content change makes existing saved state incompatible. Checkpoints expire automatically and do not replace encrypted database/file backups. Render Free can still restart or cold-start; recovery preserves committed state rather than guaranteeing continuous availability.

## Verification

Commands:

```sh
npm test
node --test examples/party-engine/test/*.test.js
npm run check
npm run build
npm run test:integration
npm run test:production
```

The integrated workflow exercises PostgreSQL 16, built-runtime restarts and three application browsers. A separate PostgreSQL 18 job verifies atomic competing writes, expired-code reuse and payload capacity. The guest-browser suite adds restored-connectivity and deliberately dropped-acknowledgment scenarios.

The local twenty-player scenario uses real WebSocket connections from one source IP and an in-memory persistence adapter. It verifies burst answers, concurrent replacement sockets, restart recovery and replayed requests with unchanged scores. Its sampled p95 acknowledgment latency was 29 ms in an isolated run and 58–71 ms alongside other tests. These are local synthetic measurements, not Render/Neon or household-Wi-Fi performance claims.

## Actual game-night acceptance still required

1. Open the hosted page before guests arrive and wait for readiness after any cold start.
2. Have 10–20 actual phones scan the QR and join from the same Wi-Fi; verify the names and roster count.
3. Play an existing quiz and a private-role game. Check that answers/roles stay hidden until the intended reveal.
4. Lock/unlock phones, switch to another app and restore Wi-Fi. Confirm the same identity and score return.
5. Briefly disconnect the host and continue after recovery. Verify the host controls and one-time scoring.
6. Record dropped joins, reconnect time, delays and the final scoreboard. Restart testing belongs in an isolated test environment.

## Research references

- [Codenames: durable rooms and role-specific projections](https://github.com/c-st/codenames/blob/f0c9a6c91f99a0c545e6328b1f1d894fd731fb84/packages/api/src/gameServer.ts)
- [Rocketcrab: party and match lifecycle](https://github.com/tannerkrewson/rocketcrab/blob/5ad9ca69910acb75c140323624603a3d8c966a37/server/rocketcrab.ts)
- [Impostor: validate before routing game messages](https://github.com/Impostor/Impostor/blob/703915f06fcfd17bc8804d36dd67655671a66cf2/src/Impostor.Server/Net/Client.cs)
- [Johnbox: correlated responses and object versions](https://github.com/InvoxiPlayGames/johnbox/blob/69ec98e92226168d8fd11c4dbbe4de21fae6b2e1/johnbox.js)
- [Spyfall: separate private role delivery](https://github.com/VeryBadFrags/spyfall-server/blob/536d3170e53604f87a539fe14e6b3cd22b4f0cd1/src/spy.ts)

## Current-main open game pack and Grand Prix integration

The October 26 main integration keeps all published game modes, guest QR entry
and the Grand Prix UI. The existing version-1 checkpoint now preserves the
authoritative active-game `pack` (kart order, laps, heat results, items,
private board/role state), `show`, racing settings and host-ended marker.
A missing active-game snapshot is rejected rather than silently resetting it.

Fast `race_input` packets are validated and rate limited without performing
one database write per controller message. The authoritative race simulation
checkpoints at most once every 100 ms per active room, and sends frames after
the checkpoint commits. A pending checkpoint blocks another race tick to
bound write backlog. Match results, credentials and scores remain committed
before acknowledgement or reveal. Checkpoint persistence is still not a
production-level backup or a physical 20-phone test.

The new `test/party-checkpoint-open-pack.test.js` covers playing-state
roundtrips, mid-race reconnect, 20 kart recovery, stale controls and once-only
heat scoring. Automated CI must pass on the integrated branch before review.

## Latest-main compatibility: Tap Dash, Sakura Arcade and Game Night Championship

The integration with main through PR #74 keeps the Sakura Arcade UI and
phone/controller handlers. Room snapshots now include the cumulative,
room-scoped `championship` map, game history and completed-match ID set,
preventing a restart from erasing standings or replaying an already scored
match. The live `tap` pack and 20-controller roster are saved and restored.

Tap Dash and Grand Prix inputs use authenticated, bounded low-latency socket
handlers. The shared 100 ms frame loop serializes authoritative room advances,
checkpoints changed state and releases private phone/public host frames only
after the save succeeds. It does not turn every 20 Hz control into a database
write. Racing limits remain 40 messages/s and Tap Dash 18 messages/s per
controller. No change to the other game's guest QR join, account requirements
or production deployment.

Run regression, browser, PostgreSQL, and 20-controller checks on this PR;
these are not evidence of real-device Wi-Fi reliability on a live Render host.
