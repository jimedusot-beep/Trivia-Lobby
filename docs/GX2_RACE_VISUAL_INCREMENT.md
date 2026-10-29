# GX2 Grand Prix visual increment — Agent 01

Status: **prototype / draft PR**, October 29, 2026. Issue: [#98](https://github.com/jimedusot-beep/Trivia-Lobby/issues/98). Base: `main` at `55414cd7d3f8cc903897f5d40f3d0e914aea579b`.

## What changed

- Added an original, more differentiated kart silhouette using a layered nose stripe, two side pods, headlights and a clearer rear wing. The driver, shield, boost and existing racer number remain.
- Changed the front wheels to child axle groups, so the host 3D rendering can visibly steer them using the difference between consecutive authoritative frame angles. This is cosmetic: position, input, physics and scoring do not change.
- Split the boost plume into two symmetric exhaust flames, retaining existing race boost visibility and reduced-motion behavior.
- Added 36 instanced festival pennants and 36 instanced poles at trackside offsets. The decoration uses four extra draw calls rather than a unique draw call for each object.
- Reduced optional per-kart accents after an initial pass to keep host rendering practical at up to 20 simultaneous racers.

All additions use original procedural Three.js geometry and local materials. **No external asset files, code, music, fonts, network packages or license grants were imported.** Existing pinned Three.js and Super Kart 3DJS notices stay unchanged; this PR does not update central source manifests.

## File boundaries

Changes are limited to `examples/party-engine/render/race-3d-scene.js` and this document. The existing `createRaceScene({onContextLost})` API, `render(frame,previous,interpolation,now,reducedMotion)`, `dispose()`, and `setCamera(mode)` remain intact.

The server simulation, phone/controller module, `race-ui.js`, WebSocket protocol, race item rules, results, scoring, replay/checkpoint flow, 2D fallback and other 30 native game modes are unchanged. This keeps the branch independent of open tilt PR #93 and shared phone UX PR #97.

## Verification required before review approval

- [ ] `npm run check`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] `npm test --prefix examples/party-engine` including the race renderer transfer budget
- [ ] Focused browser `race-3d.spec.js`, `racing.spec.js` and available cross-browser suites
- [ ] Real 3D/WebGL with 2, 10 and 20 players; compare `data-draw-calls`, frame-time percentiles and original baseline on the same machine
- [ ] Real WebGL context loss -> 2D; hidden-tab pause; repeated 3D/2D switching; host dispose; no 3D requests on phones
- [ ] Overview/director camera and 1920x1080 screenshot baseline-vs-candidate at the same racer positions, including clear player numbers
- [ ] Verify no low-vision problems; reduced motion and no flashing effects
- [ ] Review runtime memory/disposal and apparent kart steering direction on actual render
- [ ] Check asset/credits route and clean source release before deployment

This implementation was committed via a remote repository editor **without a local checkout, installed dependencies, browser/GPU environment or generated visual screenshots**. The above commands have **not been run** as part of this implementation; passing or performance is not claimed.

## Follow-up

Agent 01 or Agent 08 should run the actual browser/CI acceptance checks, repair any breakage, capture screenshots and report measured before/after effects. If these additions exceed GPU/draw-call budget, simplify accents or add more instancing before review. Licensed Kenney asset import is deliberately deferred to a separate, auditable asset-integration PR after archive provenance review.

No merge or deploy authorized. Rollback: revert this narrow renderer commit.
