# Milestone 4 — Production bundle, browser loading and Grand Prix measurements

October 30, 2026. This changes benchmark tooling and release documentation only. The earlier timer optimization has already merged as PR #112. No gameplay behavior, WebSocket logic, database migration or deployment setting is changed.

## Baseline: real compilation output
The production build on the PR #112 source commit (GitHub Actions run 41126524637) reported these actual compiled sizes:
- Main React JS chunk: 765.44 KB uncompressed; 211.78 KB gzip
- Shared proxy JS: 111.40 KB; 36.63 KB gzip
- Main CSS: 126.18 KB; 22.86 KB gzip
- Host React JS chunk: 17.82 KB; 5.81 KB gzip

Source: https://github.com/jimedusot-beep/Trivia-Lobby/actions/runs/41126524637

These file sizes are not browser transfer time, first contentful paint, interaction latency or FPS. The current Vite build retains a warning that the largest JS chunk exceeds 500 KB. The guest-party page and dynamic Grand Prix 3D chunk are separate from the main React bundle.

## Newly repeatable performance experiment
Run the separate GitHub Actions workflow named "Measured UI performance". It installs existing npm dependencies, produces the real production build, measures each JS/CSS asset's on-disk bytes and gzip bytes, and saves them to performance-results/bundle-sizes.json. It also reports the optional compiled guest 3D JS chunk size, separately from the React root bundle.

Next, Chromium connects to the existing local guest-server test fixture. Three fresh browser contexts measure actual navigation response-end, DOM-content-loaded, load-event-end, and the Playwright-observed time of the server WebSocket's ready status. Raw samples and medians are saved in party-page-loading.json.

Finally the existing Grand Prix Playwright fixture creates a real server-hosted match with two browser players. It captures 120 requestAnimationFrame gaps in the real 3D race, switches to the actual 2D fallback, then switches back to 3D and measures again. For each mode it saves p50/p95/worst rAF gaps, and for 3D also the scene's render-frame counter, scene draw calls and resource timing for the on-demand 3D bundle. Data goes into grand-prix-rendering.json.

The workflow uploads all JSON files as a 14-day Actions artifact named "measured-ui-bundle-and-rendering". No commercial service, third-party code copy or new dependency is involved. No production site is visited and no user data or telemetry is collected.

## Interpretation and limits
- The CI runner is virtual Ubuntu + headless Chromium. Browser rAF intervals are not direct GPU draw-time measurements. The 3D scene frame counter confirms actual rendering activity; 2D currently lacks a separate draw counter.
- Local loopback loads are NOT live Render loading, mobile network timing, cold cloud instance startup or household Wi-Fi latency.
- One two-player synthetic race is NOT a 10- or 20-physical-phone capacity test.
- Record a baseline from a known SHA before changing code splitting or graphics, then rerun the same workload at the next SHA. Do not mix machine/platform samples and claim a percentage improvement.
- All original game tests and existing root/guest CI suites remain authoritative release gates.

## Physical-device release preparation (all checks unverified until explicitly performed)
- [ ] Main post-merge CI, Chromium/Firefox/WebKit guest browser suites and integrated PostgreSQL/backup checks all pass on a known SHA.
- [ ] Confirm live Render service's actual SHA and backup/rollback approach. Require a separate explicit owner approval before deployment.
- [ ] On a Windows laptop, verify TV HDMI output and actual native full-screen/Escape using Chrome or Edge. Confirm visible QR, room code, roster, selected game, countdown and championship.
- [ ] Join at least two real phones (iPhone Safari and Android Chrome where available). Scan QR, finish a Quiz plus a different game, return to same room, verify scores/settings and reconnect.
- [ ] Rotate a phone while selecting a candidate among 20 names, verify keyboard/switch focus; ensure a single intentional submission, never an accidental tap during rotation.
- [ ] Run 5, then 10, then 20 real phones on the intended Wi-Fi. Measure actual join/ack p50/p95, error count, disconnects, display frame gaps and CPU/RAM. Report failed runs and device models.
- [ ] Test host refresh, one guest disconnect/reconnect, selected settings across recovery, retained championships and accepted actions, and a safe staged server restart if a separate staging DB is available.
- [ ] Exercise real 3D and 2D Grand Prix, context loss fallback, reduced motion, 320px screen, contrast and keyboard focus; compare real Windows frame gap distributions to CI.
- [ ] After explicit release approval, perform controlled deployment, confirm deployed commit and smoke-test the site. If necessary roll back service code without resetting Neon or deleting player data.

RELEASE GATE: tested GitHub main + measured performance with correct labels + actual two-device/TV acceptance + explicit deployment approval. Merging a PR alone does not satisfy these gates.
