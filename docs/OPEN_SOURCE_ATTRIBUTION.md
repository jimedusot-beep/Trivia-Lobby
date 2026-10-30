# Open-source attribution and adoption decisions

Milestone 1 review, 2026-10-30. No new external source code, assets, dependencies, or license changes were introduced. Existing notices in `docs/DEPENDENCY_LICENSES.json`, `examples/party-engine/open-pack/`, `docs/GX2_PROVENANCE_AUDIT.md` and the generated `/party/open-source/` distribution remain in place; this incremental record does not replace their file-level provenance.

## Candidate review

The actual upstream LICENSE files below were read at the pinned commits, alongside latest commit metadata. Recent commits are a maintenance signal, not proof of support or security. The research revisions are not package versions installed in this application.

| Candidate | Verified license / pinned source | Latest commit date (UTC) | Decision |
|---|---|---|---|
| Playwright | [Apache-2.0](https://github.com/microsoft/playwright/blob/1d5572d5ddfb7f3c8dfbbe19c8e97def0b2738db/LICENSE) · `1d5572d5ddfb7f3c8dfbbe19c8e97def0b2738db` | 2026-10-30 | Reuse existing @playwright/test 1.64.1. Cross-browser journeys and traces already cover the application. No copied upstream source or package upgrade. |
| boardgame.io | [MIT](https://github.com/boardgameio/boardgame.io/blob/47adef2b46e375999931209ba7b41e9654c506e1/LICENSE) · `47adef2b46e375999931209ba7b41e9654c506e1` | 2026-10-26 | Not adopted: existing authoritative engine, phases, checkpoints and deduplication cover this role; a second engine would increase migration risk. |
| Socket.IO | [MIT](https://github.com/socketio/socket.io/blob/1eaa582d3b453e3e6f522300ed05b10da0a0799b/LICENSE) · `1eaa582d3b453e3e6f522300ed05b10da0a0799b` | 2026-09-29 | Not adopted: existing ws transport and recovery must be preserved. Replacing the protocol is unnecessary for these failures. |
| Phaser | [MIT](https://github.com/phaserjs/phaser/blob/02d8931b626d9764c133cbb3fbf99966c03c757c/LICENSE.md) · `02d8931b626d9764c133cbb3fbf99966c03c757c` | 2026-08-21 | Not adopted: current Canvas and Three.js rendering need no new 2D engine for test corrections. |
| Three.js | [MIT](https://github.com/mrdoob/three.js/blob/22a58ce7c5a0ff860b2e8d57aa6d8bc95b3fd1c2/LICENSE) · `22a58ce7c5a0ff860b2e8d57aa6d8bc95b3fd1c2` | 2026-10-30 | Retain existing 0.180.0; no renderer change in Milestone 1. Review GPU budgets in Milestone 4. |
| axe-core | [MPL-2.0](https://github.com/dequelabs/axe-core/blob/6b52b841461bd23345970b91ec75fdaff6bad31a/LICENSE) · `6b52b841461bd23345970b91ec75fdaff6bad31a` | 2026-10-21 | Retain existing @axe-core/playwright/axe-core 4.14.0. Integrated acceptance already includes accessibility journeys; no source copied. |
| web-vitals | [Apache-2.0](https://github.com/GoogleChrome/web-vitals/blob/e773747b90f0e8763aed02ba5a74358d628a828c/LICENSE) · `e773747b90f0e8763aed02ba5a74358d628a828c` | 2026-10-16 | Deferred to measured optimization. No new telemetry or dependency; collect local-only metrics before deciding integration. |
| Lighthouse | [Apache-2.0](https://github.com/GoogleChrome/lighthouse/blob/970f00feede1b2541aec3ab3fd25351a9f74960c/LICENSE) · `970f00feede1b2541aec3ab3fd25351a9f74960c` | 2026-10-29 | Deferred as an optional local audit tool for Milestone 4; not installed or added to the application. |
| canvas-confetti | [ISC](https://github.com/catdad/canvas-confetti/blob/20eebad51dde793070c373d594099a7ed8d96e22/LICENSE) · `20eebad51dde793070c373d594099a7ed8d96e22` | 2025-10-25 | Retain existing 1.9.4; no new celebration effects in Milestone 1. |

## Compatibility and security scope

Existing Playwright and axe-core remain development/test dependencies. Three.js and canvas-confetti retain their current locked runtime versions and existing notices. A clean `npm ci` and `npm audit --audit-level=moderate --json` on 2026-10-30 reported zero known advisories for the root lockfile. This is an npm database result, not a guarantee of vulnerability freedom. Non-adopted candidates were not installed, compatibility-tested or security-certified; review their exact releases, transitive dependencies, asset licenses and advisories before any later adoption. No external fonts, audio or images were added here.

## Changed original project files

The TV/tilt corrections and manual capture script originate from this repository's PR #107 (`abdb767`, `55d6e44`); racing housekeeping originates from PR #109 (final head `01bf86e`). Both source heads are preserved as ancestors on the integration branch. They adapt the project's own tests using public Playwright APIs; they do not copy upstream Playwright implementation. `.github/workflows/party-engine.yml` removes obsolete historical-fixture fetching. No third-party modified-file list or new NOTICE is required for this milestone.
