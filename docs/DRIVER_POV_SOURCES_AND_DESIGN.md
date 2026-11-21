# Driver POV and split-screen: sources, design and limits

## Scope

This note covers the host-only Party Grand Prix display work on
`phase1b-driver-pov`: one-to-eight-player split-screen and the two-player
first-person **Driver POV**. Server authority, scoring, phone controllers and
all other games are unchanged. The original checkout was never modified; all
commits were made from a disposable clone.

## Sources consulted

- **Three.js Layers** — an object is visible to a camera only when their layer
  masks intersect; layer membership does not propagate automatically to
  children, so the cockpit hierarchy is traversed explicitly.
  https://threejs.org/docs/pages/Layers.html
- **Three.js WebGLRenderer** — `setViewport`, `setScissor` and `setScissorTest`
  are renderer state; the lower-left origin rule is why CSS rectangles are
  converted before each pass. The manual's multiple-scenes example turns
  scissoring off for the full clear and back on for cell rendering.
  https://threejs.org/docs/pages/WebGLRenderer
  https://threejs.org/manual/en/multiple-scenes.html
- **Super Kart 3DJS**, MIT, `d94f63da26b6a01ecbfc1e301e5d754ea64649c2` —
  the existing locally retained source reference for renderer initialization.
  Only the adaptation pattern is reused; no kart, track, art or physics asset
  was copied. See `examples/party-engine/open-pack/licenses/race-3d-reference.txt`
  and `docs/PARTY_GRAND_PRIX_3D.md`.
- **Project bilingual identity contract** — every new first-party string needs
  explicit English/Spanish copy or a recorded uncovered surface.
  `docs/BILINGUAL_IDENTITY.md` and `examples/party-engine/public/i18n.js`.
- **Project performance gates** — software-WebGL loopback measurements are not
  physical TV/iPhone results. `docs/PERFORMANCE_AND_DEVICE_RELEASE_GATES.md`.

No new third-party dependency, asset or license was introduced.

## Design decisions

1. **One renderer, one canvas.** `renderSplitViewports()` issues one scissored
   `render()` per cell and restores scissor test, viewport and scissor in a
   `finally` block. A draw failure cannot leave a half-sized viewport behind
   for the 2D fallback.
2. **Identity over rank.** Follow cameras and visible-kart selection are keyed
   by kart number, never leaderboard rank or frame order. `DRIVER_POV_CAMERA`
   permits a zero `back` offset because the focus kart mesh is hidden rather
   than sitting in front of the lens.
3. **Per-view cockpit on private layers.** Each POV gets a dashboard, wheel,
   pillars, gauges and player plate on its own camera layer. The hierarchy is
   traversed so every child shares that layer. Overview and Race Director
   cameras never enable it, so the detail cannot leak into the broadcast view.
   Plate materials/textures are cached per driver number and released once by
   `dispose()`, avoiding a GPU leak when the split count changes.
4. **Transient visibility is baseline-tracked.** Split rendering temporarily
   hides shared scenery and kart detail. A pre-split snapshot is captured on
   entry and invalidated on mode/count changes or after an error, so restoring
   visibility always refers to the current roster.
5. **Metadata follows the active view.** `data-split-rects`,
   `data-split-visible-karts` and `data-driver-pov-visible-karts` are removed
   when returning to Whole Track. HUD placement and ARIA copy read the active
   camera mode, and the new POV option is disabled unless at least two racers
   are present.
6. **Presentation-only localization.** The new option label, status and canvas
   description use `t()` and re-render on `party-locale-change`; locale changes
   never alter the stored display ID or authoritative frame data. The rest of
   the race UI remains an explicitly documented English-only surface for now.

## Verification

- Node contract suite: 387 tests, 0 failures.
- Real WebGL Chromium POV contract: canvas screenshots decoded with `pngjs`,
  checking color diversity, non-background and road ratios, distinct halves,
  correct `data-engine`, and restore behavior after an injected draw failure.
- Existing 3D/split Chromium contracts: 19 passed.
- Performance specs: 2 passed. One shared renderer used 25/52/78/104 scene
  draw calls for 2/4/6/8 cameras; direct `renderMs` was 1.55/1.55/2.11/1.89 ms
  and the eight-racer simulation p50/p95 were 0.0421/0.105 ms.
- All WebGL in these runs was ANGLE/SwiftShader software rendering on a shared
  host. These numbers are diagnostics, not GPU time and not TV/iPhone evidence;
  physical-device release gates still apply.

## Attribution

The driver POV camera maths, cockpit geometry, visibility selection, tests and
documentation are original to Trivia Lobby. Third-party notices remain in
`examples/party-engine/open-pack/licenses/` and
`docs/OPEN_SOURCE_ATTRIBUTION.md`.
