# Open Party Lab → Trivia Lobby: phone-controller and minigame integration study

**Study date:** 2026-10-26  
**Scope:** Open Party Lab only. No new game is represented as playable by this document.  
**Trivia Lobby base:** [6f384a5897d9b59d6d681e542e36cd7659dd672b](https://github.com/jimedusot-beep/Trivia-Lobby/commit/6f384a5897d9b59d6d681e542e36cd7659dd672b).  
**Open Party Lab reference:** [bb221f92d1b29afce1cd5b3953c7450612d52a71](https://github.com/Hartwich/Open-Party-Lab/tree/bb221f92d1b29afce1cd5b3953c7450612d52a71) (Apache-2.0 code, subject to per-asset/dependency checks).

## Decision

**Adapt the architecture and interaction patterns, not the whole platform.** Trivia Lobby already has a guest-first QR lobby, 20-guest cap, authenticated reconnect, bounded action protocol and server-authoritative scoring. Open Party Lab's most useful addition is the clean separation between **game manifest**, **server reducer**, **shared protocol**, **shared host renderer**, and **phone controller layout**. Replacing the guest engine or adding a Socket.IO service would duplicate security, sessions, hosting and operations.

The source review does **not** establish that Open Party Lab's 21 optional game projects support 20 simultaneous players. The upstream README calls most games alpha/beta; its public test server is not production infrastructure. A downloadable Windows launcher exists, but Raspberry Pi feasibility is not established by that release.

## Actual components examined

| Open Party Lab | Responsibility | Trivia Lobby integration seam |
| --- | --- | --- |
| `packages/game-core/src/types/GameManifest.ts` | Game ID, player ranges, controller layout, host view, timing, visual and broadcast policies | Existing `examples/party-engine/public/game-catalog.js` and `public/pack-config.js`; introduce a shared game manifest **incrementally**, without copying package layout |
| `apps/server/src/game-engine/gameRegistry.ts` | Resolve optional game modules by manifest; omit missing games | Guest `engine.js` plus `open-pack/index.js`; favor a small approved registry, never dynamic untrusted loading |
| `apps/controller/src/controller-ui/layouts/models.ts` | Typed reusable touch-controller models | Create accessible guest-side controller renderers for specific new games; controls send **intent**, not score or position |
| `apps/controller/src/controller-ui/common/DPad.tsx` | Four large direction buttons | Useful for 2D arenas; preserve touch/keyboard alternatives |
| `apps/controller/src/controller-ui/layouts/RacingControlsLayout.tsx` | Steering, throttle, brake, drift, boost, fire with dead zone and pointer cancellation | Reference for a future original top-down racer; debounce/batch inputs, force neutral state on release, blur and disconnect |
| `apps/server/src/rooms/roomLifecycle.ts`, `packages/protocol/src` | Room phases, server clock, input/state messages | Use existing `Party.enter`, `Party.tick`, `protocol.js`, `projections.js` and `transport.js`; do not change credential format |
| `docs/minigame-sdk.md` | Game contract, host/phone separation, host-owned screens | Blueprint for a local adapter interface; all new games must still comply with Trivia Lobby's guest privacy and security model |
| `config/known-games.json` | Links 21 separate optional source repositories | Treat each game as an independent project with independent license, current functionality, player limits, and asset audit |

Source index: [upstream architecture](https://github.com/Hartwich/Open-Party-Lab/blob/bb221f92d1b29afce1cd5b3953c7450612d52a71/docs/architecture.md), [minigame SDK](https://github.com/Hartwich/Open-Party-Lab/blob/bb221f92d1b29afce1cd5b3953c7450612d52a71/docs/minigame-sdk.md), [controller layout](https://github.com/Hartwich/Open-Party-Lab/blob/bb221f92d1b29afce1cd5b3953c7450612d52a71/apps/controller/src/controller-ui/layouts/RacingControlsLayout.tsx), [upstream status](https://github.com/Hartwich/Open-Party-Lab/blob/bb221f92d1b29afce1cd5b3953c7450612d52a71/docs/project-status.md), [upstream notices](https://github.com/Hartwich/Open-Party-Lab/blob/bb221f92d1b29afce1cd5b3953c7450612d52a71/NOTICE.md).

## Proposed guest minigame contract (design only)

A new minigame should supply these five **independent** parts, with no hidden imports from Open Party Lab:

1. **Manifest:** stable mode ID, localized title/rules, min/max **active** players, spectator behavior, expected duration, controller kind, and supported host UI.
2. **Server reducer:** `start`, `acceptInput`, `tick`, `advance`. Only the reducer can change position, hit points, scores or round results. Reject actions for the wrong game/phase/actor.
3. **Projection:** explicit host versus player views. Return only public state and the calling player's private data; never serialize the room, credentials or hidden state.
4. **Phone controller:** game-specific accessible buttons, D-pad or bounded analog vector; send a small versioned intent payload to the existing guest WebSocket. Display only server-confirmed results.
5. **Host renderer:** display a deterministic projection for TV/laptop. Animation can interpolate between snapshots, but authoritative simulation is not run in the browser.

Reuse **existing** `examples/party-engine/transport.js` authentication, per-socket message budget, origin enforcement and reconnection. Reuse `engine.js` match ID/revision checks and `projections.js` boundaries. Preserve the existing 24 guest modes and all study/private-account APIs.

### Input safety, not just a pretty gamepad

- For continuous movement, use small direction vectors/booleans with strict finite numeric ranges; reject unknown keys, malformed JSON and oversized payloads. Apply acceleration, collisions, movement and boosts on the server.
- Keep a **server-owned monotonic tick**, bounded delta time, player-input expiry and authoritative score/health. A player who disconnects or suspends their phone must stop accelerating/attacking.
- Touch `pointercancel`, loss of pointer capture, hidden tab, blur, and reconnect must neutralize held inputs. Avoid stuck acceleration/steering.
- The current guest `transport.js` allows at most **60 messages per 10 seconds per connection**, limits incoming messages to **32 KiB**, and closes a socket when outbound buffering exceeds **65,536 bytes**. These are current implementation observations, **not** performance certification. Do not implement a 30–60 Hz per-player raw input stream under these limits. For any realtime mode, separate intent sampling from authoritative simulation and **coalesce/throttle outgoing projections** instead of broadcasting to all 20 sockets on every input.
- Preserve idempotent request IDs and stale `matchId`/`revision` rejection; avoid using a `revision` bump for every physics tick if it invalidates in-flight player actions.
- Never authorize based on a client-provided player ID or trust a phone to report who won.
- Cap arena entities/projectiles, room memory, timers, simulation work per tick, input frequency, and post-disconnect session duration; test 20 players on the actual intended hardware.

## A practical, bounded pilot

**Candidate A: an original 2D top-down arcade racer inspired by Open Party Lab's [Drift Racer](https://github.com/Hartwich/drift-racer)** (not a fork). This is the most interesting *wow-factor* test of its `racing_controls` pattern, but the hardest to validate at 20 players. Limit first version to one course, steering/throttle/brake, server-driven lap/checkpoint validation, one boost, and a shared spectator/host track. No Nintendo/Crash assets.

**Lower-risk fallback: [Tap Race](https://github.com/Hartwich/tap-race)**, whose upstream README describes an alpha phone-tapping sprint. It could prove a game manifest, phone controller, 20-person scoreboard and server tick without physics. No source or assets are copied in this study.

### Integration acceptance gates, in order

- [ ] Select **one** pilot game and specify original rules, target controls, active player limit and fallback for spectators before writing game logic.
- [ ] Add a server game module, typed/validated action contracts and explicit host/player projections, using the existing guest engine.
- [ ] Wire a phone-sized controller with pointer release/cancel safety, keyboard alternative, and accessible labels/feedback. Ensure no scrolling or input loss at 375 px width.
- [ ] Wire shared-screen game display and host start/end/restart. Keep existing QR invitation and signed reconnect credentials.
- [ ] Unit tests: input bounds, invalid actors, duplicate requests, stale revisions, server-only physics/score, timers, disconnect neutralization and state exposure.
- [ ] WebSocket integration: 10 and **20 real socket clients**; hostile input, host/client reconnects, simultaneous actions, match end, teardown and next game. No new database or Render service.
- [ ] Browser/device: iOS Safari/Android Chrome, pointer cancellation, foreground/background, Wi-Fi interruption, phone rotation, reduced motion and shared-screen fullscreen.
- [ ] Load: 20-player p95 input-to-display latency, outbound bytes/s, CPU/RAM on target laptop or Raspberry Pi, websocket backpressure and no lost/reordered final state. Capture **measured** values before setting thresholds.
- [ ] PR review, license/asset verification, CI, merge, manual Render deployment, live 10–20 phone game night. These are **separate** completion steps.

## License and deployment boundaries

Open Party Lab's platform code says **Apache-2.0**; individual optional games, assets, dependencies, word lists and generated media must be checked separately. The Trivia Lobby open game pack already contains AGPL-licensed adaptations; do not assume Apache-, MIT- or proprietary assets may be redistributed without reviewing obligations. This study copies **no code or assets** from Open Party Lab. If any source is copied later, record precise upstream file/commit and notices in the existing provenance and in-app Credits & Source page.

**Deployment:** no extra vendor, account or paid service should be introduced. The existing guest HTTP/WebSocket service on a single Node process can host the pilot. Render Free can sleep and restart, interrupting rooms. Self-hosted LAN use must be verified rather than promised. Current production backup, branch protection and physical 20-player acceptance issues remain independent release gates.

## Outcome of this research slice

- **Verified:** upstream repository and documented separation of host/controller/server, 21 *optional* game repository references, generic game/controller contracts, and compatible high-level guest patterns.
- **Not implemented:** upstream games, reusable controller runtime in Trivia Lobby, authoritative racing physics, 20-player throughput improvements or a Raspberry Pi deployment.
- **Next code PR:** a single original minigame adapter and pilot game, built and validated separately. Do not present a research PR as a playable feature.
