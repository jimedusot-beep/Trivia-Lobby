# Solo Lab — open-source and community research

Researched October 31, 2026. **This document is an inspiration/engineering comparison, not a claim that third-party software was forked or merged.** The current implementation uses our existing `ws` transport and server-authoritative game rules with original UI/virtual-player glue.

## Strong reference projects

| Project | Public repository / stated license | Useful mechanic | Decision for Trivia Lobby |
| --- | --- | --- | --- |
| Bomb Party | https://github.com/msynk/bomb-party — MIT | Explicit development-only bot add/remove and latency simulation, real party display + phone controllers | **Adopt idea:** dedicated testing UI and later network chaos knobs. **Do not copy** its protocol or bypass production guards. |
| GameNest | https://github.com/absswds/GameNest — Apache-2.0 | Bot-filled empty seats, 34 board/card/party games, LAN-hosted QR play, reconnect, per-player secret data | **Study** seat-fill patterns for turn-based games and private view projections. **Do not copy** art or third-party game content. |
| Tiny Strike | https://github.com/guyz/tinystrike — ISC (code, third-party assets separately licensed) | Clearly separated solo+bots, human-only, mixed humans+bots | **Adopt idea:** do not confuse simulator sessions with humans; label demo rivals and never trust client-claimed authority. |
| Multiplayer Room Starter | https://github.com/sayembillah-dev/multiplayer-room-starter — MIT | Room lifecycle smoke tests, authenticated session / reconnect design | **Borrow test pattern:** full-room lifecycle smoke evidence, not replacement socket architecture. |

Before any **actual code copy or fork merge**, audit the exact revision's LICENSE, embedded asset rights, source notices, dependencies, and transitive licenses. Preserve attributions and GPL/AGPL obligations where relevant. Linking a repository or borrowing a design principle does not by itself import its code.

## Community reports and cautions

- r/gamedev: https://www.reddit.com/r/gamedev/comments/1g0ml3r/ — people building 4–8-player games recommend bots for initial solo UI testing, then scheduled human playtests.
- r/gamedev: https://www.reddit.com/r/gamedev/comments/1e72d46/ — bot swarms, record/replay and latency/packet-loss simulation are discussed for repeatable multiplayer testing.
- r/SoloDevelopment: https://www.reddit.com/r/SoloDevelopment/comments/1uthomz/ — simulated players catch basic functionality bugs but cannot uncover all real human behaviors.
- r/godot: https://www.reddit.com/r/godot/comments/1wxkqg3/ — a developer reports using an automated multiplayer harness with AI clients to check replication and balance.

These are community experiences, **not** guarantees about network performance or gameplay quality. The most useful outcome for Trivia Lobby is a **layered test strategy**: unit/protocol checks, repeatable automated virtual-player tests, and real phone/TV testing.

## Implemented in PR #118 (not production)

- Separate `/party/solo-test.html` route with real game-host and player sockets in a *single tab*
- Explicitly labeled demo rivals, temporary room, and Stop control
- Real Quiz, Party Grand Prix and Tap Dash sessions without reducing minimum-player validation
- **Test room size: 2–5 seats** according to game minimums (you + 1–4 virtual rivals, quiz requires at least 3)
- Real server scoring and UI; optional bot race/tap inputs remain rate-limited by the existing server
- Playwright browser evidence for quiz/host/controller/multi-seat phone layout and clean Stop

## Next implementation candidates (not yet built)

1. **Per-game adapter architecture:** mode-specific legal client actions for social, board, and card packs. Each adapter must use the same participant projections as human players and respect hidden cards/secret roles. A fake client must never use the host's private state to choose answers.
2. **Repeatable scenarios:** deterministic seeds for bot decisions, pause/step, replay a failing sequence, export a *sanitized* report with phase duration and errors (never room tokens or private prompts).
3. **Development-only network chaos** for reconnection, delayed messages and packet loss. Only in local or authenticated development; never offer public unauthenticated controls for generating load.
4. **Headless 4/10/20-client load harness** outside regular party rooms, with concurrency/resource caps and explicit setup; this is a different workload from the safe one-tab up-to-five test.
5. **Physical device gate:** TV display + iPhone/Android controllers, tilt permission, QR join, recover after disconnect, and tests with actual people.

## Why we did not clone the complete projects

Trivia Lobby has its own validated authenticated WebSocket message protocol, live-room checkpointing, race simulation and original visual identity. Swapping a complete Socket.IO/Colyseus server or copying another game's packaged art would be high-risk and unnecessary for this one-tab feature. **For now we learn, implement original adapters, and maintain the shortlist for later isolated fork experiments.**
