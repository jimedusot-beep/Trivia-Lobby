# Doodle Dash: isolated smooth SVG stroke trial

Research and implementation: November 1, 2026. Baseline: `main` before this draft PR.

## Player problem
Quick finger movements produce visibly angular line joins in the phone and host drawing display. This change renders previously validated stroke points with a lightweight SVG quadratic curve. The payload, saved points and authoritative game rules are unchanged.

## External reference and reuse boundary
- Public source: https://github.com/steveruizok/perfect-freehand/tree/176e00f2399f4969e1b0965c5921d96a3e50ce9f
- Upstream license reported by GitHub: MIT. Audit exact files and notices if any future dependency or code is imported.
- **Reference only:** no source copied, no dependency or new assets installed. This PR implements its own simple quadratic midpoint interpolation, **not** pressure-sensitive Perfect Freehand rendering.

## Impacted files
- `public/drawing-stroke.js`: pure stroke-point to SVG-path adapter, rejects malformed geometry.
- `public/drawing-ui.js`: apply that same adapter to existing strokes and the live preview.
- `test/drawing-stroke.test.js`: endpoint, malformed-input, deterministic and unmodified-points regression cases.

## Non-goals and safety
- No changes to server-authoritative stroke geometry, segment/point caps, score, identity, permissions, game time, undo/redo, packet size or transmitted messages.
- No new library, bundle dependency, game mode, Render configuration, external service or CSS/phone-scroll redesign.
- This does not claim physical device testing, improved FPS, pressure sensitivity or a production deployment.

## Acceptance and review
- [x] Isolated Node 22 test for four helper behaviors passed locally; `node --check drawing-stroke.js` passed.
- [ ] Run existing guest `npm test` and all affected game/browser CI workflows on this exact PR head.
- [ ] Compare real phone slow and quick strokes, two-point straight segments, white eraser, undo/redo, clear, remote spectator drawing, keyboard drawing and 320 px viewport.
- [ ] Inspect visually for undesirable corner rounding, non-responsiveness and unexpected SVG path fallback.
- [ ] Check deployed-version/roll-back only after explicit release approval.

If the curve changes shape excessively at sharp corners, adjust interpolation or revert this presentation-only change; authoritative server data remains untouched.
