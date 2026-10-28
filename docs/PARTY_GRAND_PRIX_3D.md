# Grand Prix 3D broadcast view

## Contract (before implementation)

Upgrade only Party Grand Prix's host display to a real 3D elevated broadcast
camera: original procedural karts/drivers, the existing Sunset Speedway geometry,
track furniture/scenery, item boxes, drift/boost/shield feedback and number labels.
All 2–20 racers remain visible in the default whole-track view. An optional
Race director follows the lead pack with a full-track minimap and numbered roster. Phone controllers remain lightweight, nickname-only
and QR-joined. Server-owned physics, scoring, input budgets, checkpoint authority
and other games are unchanged. New tracks, jumps, handling changes and audio are
outside this first visual increment.

Only the host loads the local 3D bundle. Cap pixel ratio and rendering frequency,
share geometry/materials where practical, bound effects and reuse kart objects.
Pause rendering in hidden tabs and respect reduced-motion settings. Dispose GPU
resources/listeners when leaving a heat. WebGL failure/context loss falls back to
the existing live 2D view without reloading the room. Hosts can explicitly choose
2D or 3D. Readable numbered roster and textual results remain accessible.

## Source investigation and selected reuse

Super Kart 3DJS, MIT, revision d94f63da26b6a01ecbfc1e301e5d754ea64649c2:
https://github.com/fecolinhares/super-kart-3djs
Inspected src/render/SceneManager.js and src/entities/Kart.js. Adapt selected
renderer initialization (antialiasing, capped pixel ratio, tone mapping and color
space). Its context-loss behavior motivates a local fallback rather than its
reload approach. Kart geometry, scene layout, animation and state adapter are
independently implemented for Trivia Lobby. No characters, item names, tracks,
physics/network runtime or third-party artwork are copied.

Three.js 0.180.0 (MIT) is bundled locally at build time. Pin dependencies and retain
notices/source in the existing credits/download system. No CDN or extra service.

## Acceptance

- 3D host scene uses the same authoritative coordinates, kart numbers and colors;
  interpolation is presentation-only and no new client scoring/state authority.
- QR joining, 320px and rotated phone controls, 20 controllers, host/player reload,
  natural heat results, next heat and same-room return continue to work.
- Verify real WebGL rendering, 20-kart scene bounds, explicit 2D/3D switching,
  missing/WebGL-disabled fallback, context loss, hidden-tab pause and cleanup.
- Verify phones never request the 3D bundle, and all assets load under the existing
  self-only CSP on both standalone and /party/ mounts.
- Run root typecheck/tests/build/license inventory, guest suite and relevant
  browser flows. Inspect host and phone screenshots. Report local/software-GPU
  measurements separately from a physical 20-phone or production performance test.
