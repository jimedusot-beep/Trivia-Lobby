# Trivia Lobby — Milestone 1 release-readiness audit

Audit date: 2026-10-30. Source baseline: main `0c0ebfb8cac2d049f80917183b76d5ed2bb63d39`. Branch: `fix/milestone-1-release-readiness-20261030`. Scope is browser/fixture/CI repair; no production deployment is authorized. The PR's checks and final description carry the completion evidence for its exact head.

## Findings

- Main standard CI [40948266342](https://github.com/jimedusot-beep/Trivia-Lobby/actions/runs/40948266342) and integrated acceptance [40948266310](https://github.com/jimedusot-beep/Trivia-Lobby/actions/runs/40948266310) succeeded. Guest workflow [40948266502](https://github.com/jimedusot-beep/Trivia-Lobby/actions/runs/40948266502) failed; actual logs from Chromium job `123709244474`, Firefox `123709244460`, WebKit `123709244123` were read.
- Chromium rejects 44px controls reported as `43.99999237060547px`. Firefox's TV font is `33.625px`; WebKit's is `33.599998px`, versus exact `33.6px`. Firefox's tilt test also retried on fractional geometry. Baseline summaries: Chromium 181 pass / 1 fail; Firefox 171 pass / 1 fail / 1 flaky / 9 existing skips; WebKit 172 pass / 1 fail / 9 existing skips.
- Locally, the unchanged Chromium test reproduced at `43.99998474121094px`. The current TV test passed in Chromium. Failure screenshot and trace were retained and inspected. Initial Firefox attempts crashed before creating a page; these are environment failures, not reproductions of the font issue. Default Chromium archive download was truncated; Google's official Chrome for Testing headless shell 156.0.8078.47 ran successfully. Local results must distinguish this from CI's pinned browser.
- Read-only live `/party/open-source/credits.json` identifies deployed source `55414cd7d3f8cc903897f5d40f3d0e914aea579b`, behind main. This is the running site's public build manifest, not authenticated Render deployment metadata. The Render connector had no selected workspace; no workspace was guessed and no service settings were changed.

## Existing architecture and preservation

The root app is React/Vite with an Express/TypeScript backend, PostgreSQL via `pg`/Drizzle, versioned account-room WebSockets and persistent room checkpoints. `server/guest-party.ts` attaches the existing guest engine and static phone/host UI to that same production HTTP server. `examples/party-engine/server.js` remains the existing standalone guest development/LAN entrypoint. No second application or server is introduced.

The 31-game catalog includes Trivia Quiz, Tap Dash, Family Showdown, Party Grand Prix, Turbo Circuit, Wave Sprint, Light Trails, card/board games and social/voting games. QR invitations, TV host catalog, tilt/touch controllers, reconnect feedback, guest credentials and same-room Game Night Championship are already implemented. The championship normalizes placement points, rather than adding unlike raw scores. Playlist automation/awards need later scoped design, not another engine.

The latest migration is `0009_live_room_checkpoints.sql`; existing integration runs cover repeatable migrations, private-access tests, PostgreSQL 16, PostgreSQL 18 checkpoint recovery, production-only artifacts, backup/restore fixtures, smoke and accessibility/browser journeys. No migration changes or live DB access occur here. Render blueprint uses one Node service, manual deployment, Neon and existing private storage. Keep secrets and real data out of tests.

## Requested PR disposition (live metadata checked)

| PR | Current state | Action |
|---|---|---|
| [107](https://github.com/jimedusot-beep/Trivia-Lobby/pull/107) | Open, head `55d6e44` | Consolidated here, preserving ancestry; narrow font/geometry corrections and manual historical capture. Its six successful workflows are prior-head evidence, not the combined branch's checks. |
| [109](https://github.com/jimedusot-beep/Trivia-Lobby/pull/109) | Open, head `01bf86e` | Consolidated here, preserving ancestry; phase-aware fixture housekeeping. |
| [81](https://github.com/jimedusot-beep/Trivia-Lobby/pull/81) | Open, head `32f5302` | Still useful: countdown recovery settings. Already contains #107. Rebase/review after this branch, avoiding duplicate application; Milestone 2. |
| [108](https://github.com/jimedusot-beep/Trivia-Lobby/pull/108) | Open, head `29f2adf` | Still useful: controller focus/rotation/broadcast continuity. Runtime change remains separate for Milestone 3. |
| [84](https://github.com/jimedusot-beep/Trivia-Lobby/pull/84) | Open, head `31f136a` | Historical overlapping integration of #81/#82/#83. Do not merge wholesale over current main. Reuse useful compatibility scenarios in a fresh reliability branch. |
| [82](https://github.com/jimedusot-beep/Trivia-Lobby/pull/82) | Merged, merge `580e004` | Already in main. Ordinary WebSocket queue is bounded at 16 frames/64 KiB per socket, counts in-flight work, and reports overload with reconnectable close 1013. No duplicate implementation. |

## Changes and verification contract

- TV font tolerance is <0.05px; the 20px controller style cannot satisfy it. Host/controller/active-play scope assertions remain.
- Racing controls must retain computed CSS min-height >=44px and actual box height >=43.99px, plus viewport fit. Rotation, steering, drift/item and fallback assertions remain.
- Cleanup finds and activates the existing End this match button atomically, keeps its real confirmation/server handler, waits for authoritative `finished`/`reveal`, removes its listener, and closes contexts in `finally`. The dedicated gameplay journey still uses a normal user click and checks return to the same room.
- Historical before-image capture moves to `script/capture-tv-catalog-baseline.mjs`. Current 31-game catalog assertions remain in CI; the guest workflow no longer fetches all history or requires an old commit just for an optional capture. No new skips, timeout increases or runtime changes.
- Independent review found no blocking code findings. Standalone handoff documents are labeled historical to avoid confusing their original scope with this integration.

Local checkpoint: root typecheck, 111 unit tests (zero skips), standalone 259 tests (zero skips), production build and root npm audit (zero advisories) passed. Targeted Chromium TV/tilt/invitation/racing passed 19/19 in 2.1 minutes, zero retries/skips, including twenty-controller reload and actual host end/return. Targeted Firefox TV/tilt passed 13/13 in 53.4 seconds with zero retries/skips after setting MOZ_DISABLE_CONTENT_SANDBOX=1 locally; this changes only the container browser launch environment, not assertions or application security. WebKit startup dependencies are being supplied locally; its hosted checks remain required. The PR's full CI is an additional gate, recorded at its exact head in the PR. Hosted PostgreSQL/production checks must run for this branch; successful baseline jobs alone do not validate the integration.

Commands: root `npm ci`, `npm run check`, `npm test`, `npm run build`, `npm audit --audit-level=moderate`; standalone `npm ci`, `npm test`, `PARTY_CROSS_BROWSER=1 npm run test:browser -- --project=chromium --project=firefox --project=webkit`. Targeted suite: `tv-catalog.spec.js`, `race-tilt.spec.js`, `race.spec.js`, `mobile-host-invite.spec.js`, `race-3d.spec.js`. Never run independent Playwright commands against the same port/output directory concurrently.

## Performance and remaining gates

Runtime source, dependencies, assets and styles are unchanged by this milestone, so no loading/frame-time improvement is claimed. Local production build baseline: main client JS 765.44 kB (211.78 kB gzip); existing >500 kB chunk and SVG warnings remain optimization work. Removing full-history checkout removes unnecessary repository transfer, but no CI speedup is claimed without comparable timings. Existing load/racing measurements are synthetic evidence, not a physical-phone capacity guarantee.

All required workflows at the integration head must succeed before merge review. Each Firefox/WebKit guest job has nine existing browser-specific skips: three WebGL/GPU cases and six Chromium-CDP safe-area/controller cases. GPU and CDP-only assertions run in Chromium; the WebGL fallback runs cross-browser. These are explicit coverage limitations for non-Chromium graphics and mobile safe-area behavior. Do not call skipped cases passes. Production deployment still requires the user's explicit approval after verification. Physical Windows/HDMI, iPhone/Android/Wi-Fi, 10–20 real-device latency/capacity, and the existing corresponding-source/license-boundary follow-up in `GX2_PROVENANCE_AUDIT.md` remain outstanding. No blanket legal-compliance certification is made.

Safest next action: finish this branch's required CI and review, resolve/close superseded #107/#109 only after integration, then implement #81 plus useful #84 compatibility tests as a separate reliability milestone. Do not deploy or merge #84/#81/#108 solely on historical checks. Rollback is a revert of this focused PR; no DB operation is needed.
