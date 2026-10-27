# Light Trails Royale — native 2–20 phone arcade mode

**Status:** Original implementation in a **feature PR**. It is not the Open Party Lab source game, is not on the live Render site, and has not been physically tested on 20 phones or Raspberry Pi.

## Source and inspiration

Concept reference: [Open Party Lab Light Trails](https://github.com/Hartwich/light-trails) ([its player manifest](https://github.com/Hartwich/light-trails/blob/main/src/manifest.ts), [game engine](https://github.com/Hartwich/light-trails/blob/main/src/server/index.ts)). Upstream alpha supports 1–8 players, uses left/right hold steering and patch streaming. The source declares Apache-2.0, but assets and dependencies require separate checks.

This mode is an **original grid-based light-cycle interpretation**, not a port: no upstream source code, graphics, music, controllers, art, assets or configuration are included. All client visuals are locally rendered from author-written code. Upstream and original player caps are **not equivalent**.

## Gameplay

- **2–20 active controllers** in one existing Trivia Lobby QR room, 3 heats of at most 45 seconds each; one shared laptop/TV screen draws every glowing rider's path.
- Every phone has two big keyboard/touch-accessible buttons: **tap LEFT** or **tap RIGHT** for one 90° turn. Bikes advance automatically every 160ms. A trail collides with walls, its own previous track, or another track. Multiple bikes reaching the same unoccupied square at the same instant all crash.
- Players are credited points for survival place (ties share the same place); each heat adds to the existing guest `Party.players[].score` score. After the third heat, the server-wide Game Night Championship from PR #74 awards normalized placement points when the entire match completes.
- The host can advance heats using the existing Next button, and then return everyone to the **same** QR party for another game. Player scores remain in the match; cumulative championship persists for the room's configured retention. Host-aborted games do not earn championship points.

## Authoritative protocol and anti-cheat

- Phones send only a tiny validated `trails_input` message: v, type, matchId, heat, seq and turn -1 or +1.
- The existing WebSocket supplies the authenticated actor; no phone can nominate a player ID, score, winner, collision or position. Old heat/match/sequence and fabricated fields are rejected. Host cannot drive.
- Max **15 incoming trail packets/second/socket**, ≤256-byte fast messages; one queued turn per simulation step; 80ms accepted-turn cooldown. Unexpected game/phase still passes through the stricter normal protocol rather than the fast lane.
- The server runs a single bounded grid simulation with at most 1,536 occupied cells; state is projected at most every **150ms** during active play. Each phone sees only its own alive/step/seq status; the TV alone receives the full arena trails and leaderboard. In-flight messages do not force immediate broadcast of the whole room.
- Disconnect/reconnect clears queued turn inputs and resets sequence state; no continuously held control can remain stuck after the phone sleeps or closes. The server remains authoritative.
- Paused-process elapsed time is clamped so the game does not teleport several seconds of movement in one request.

## Tests and reality checks

- `test/light-trails.test.js`: 20 distinct spawn cells, player/host projection privacy, duplicate/replay/forged controls, disconnect neutralization, head-on simultaneous collision, wall collision, at-most-once awards and three-heat championship.
- `test/open-pack-network.test.js`: 10 and 20 **actual test WebSocket clients** with signed QR room credentials, reconnect, turn packet and individual frames. This is a simulated network load test, not 20 physical handsets.
- `browser-specs/light-trails.spec.js`: host TV canvas, 375px touch controllers and private frame delivery with two phone browser contexts.
- Full platform and guest cross-browser CI (Chromium, Firefox, WebKit) must pass before merging. Physical acceptance still needs mixed iPhone/Android phones, Wi-Fi interruption/reconnection, a typical Windows laptop or Pi's CPU/RAM, room-to-room isolation, and frame size/backpressure under 20 active players.

**Remaining unknown:** No measured target-hardware 20-player FPS/latency results or user testing with an actual room of family members. Treat the 2–20 capacity as the code's supported player count, not a guarantee of smooth action on every router or Raspberry Pi.
