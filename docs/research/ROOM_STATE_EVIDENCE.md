# Evidence-linked room-state reconstruction: first implemented slice

This implementation uses a **methodological** pattern from documented reverse-engineering case studies: infer a narrow observable contract, implement it independently, then verify invariants with repeatable tests. It does **not** include decompiled or copied proprietary game code.

## Architectural source and scope
- [DX-Ball reconstruction case](https://github.com/N0zoM1z0/dx-ball): inspiration for behavioral parity and differential tests. We are not porting that game.
- [REA](https://github.com/MaurizioCasciano/Reverse-Engineer-Anything) and [REA Reconstruction Companion](https://github.com/ShadowSwaps/REA-Reconstruction-Companion): research leads for traceable evidence capture. Neither is a runtime dependency.
- Existing Trivia Lobby server code: `server/routes.ts` is the authoritative source of the observed room protocol.

## Testable implementation contracts

| Evidence ID | Local observation and risk | Independent rule | Test |
|---|---|---|---|
| TL-REA-001 | Final leaderboard previously serialized full player objects including `ws`, `streak`, `lastSeen` | Public leaderboard contains *only* playerId, name and score; stable score tie order | `tests/room-projections.test.ts` |
| TL-REA-002 | Answer submission was bound to `userId` but did not check player's live socket identity | Only the current, connected player socket may submit an answer once per question | `tests/room-projections.test.ts` |
| TL-REA-003 | Leaderboard was capped at top five in server behavior | Projection preserves top-five maximum | `tests/room-projections.test.ts` |
| TL-REA-004 | Room code was a short random string with no collision check | Retry on a code already in use; length increased from 4 to 6 | Code review; integration test pending |
| TL-REA-005 | An old socket's close event could mark a newly rebound player disconnected | Close only updates status if socket is still the player's current socket | Code review; reconnect integration test pending |

## Known remaining issues, not claimed fixed
- Client-supplied reconnect player IDs are not securely authenticated. A reconnect secret or signed session binding is needed; merely checking a socket at answer time does not stop takeover of an existing player ID.
- Rooms are process-local; they do not survive server restarts or multi-instance deployments.
- End-to-end browser replay, private results, input schemas, room expiry, question timing, and server-side WebSocket integration tests are incomplete.
- Current tests cover pure functions, not live network sockets. Do not claim comprehensive multiplayer security.
- Room code generation now checks collisions but still relies on `Math.random`; cryptographic code generation should be considered.

## Validation
Run `npm ci && npm run test && npm run check && npm run build`. GitHub CI should execute on the pull request. Record CI results before merging.

Related: [five-track research](./AI_RECONSTRUCTION_TRACKS.md), [task #6](https://github.com/jimedusot-beep/Trivia-Lobby/issues/6).
