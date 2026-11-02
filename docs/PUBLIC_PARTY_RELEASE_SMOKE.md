# Public party release smoke — Issue #12

November 1, 2026. Focus: production-safe verification of the **actual public game experience** in addition to the separate private/study web application. This step does not deploy code, restore real data, create game rooms, or replace device QA.

## What the existing smoke test already proved

The pre-existing `npm run smoke` script:
- Waits for `/health/live` and database-backed `/health/ready`, tolerating a bounded Render Free cold start.
- Opens the private quiz `/ws` transport, checks unauthenticated room creation is rejected, and tests HTTP private-API access controls.
- Checks the private React page, private API response headers, missing API/asset 404 behavior, and a cross-origin mutation rejection.

This is important but does **not** establish that `/party/` or the separate guest `/party/socket` works.

## This PR's additional production-safe smoke

In `script/smoke.ts`, after the existing checks, read-only requests now validate:

1. `GET /party/`: 200 HTML with the visible **31-game** library marker, game picker, host button, join form, nickname/room fields, and Solo Test entry.
2. `GET /party/solo-test.html`: 200 HTML containing the one-tab setup, mode and seat selectors, and embedded host/controller stage markers.
3. Both pages: `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, and CSP with same-origin connections and `frame-ancestors 'none'`.
4. `GET /party/app.js` and `/party/solo-test.js`: successful JavaScript assets, not missing bundles or a React SPA fallback; no-store cache policy.
5. `GET /party/__smoke_missing__.js`: 404, never an HTML SPA fallback.
6. `wss://<public-host>/party/socket`: opens the guest socket with the correct Origin and sends **only** `{"type":"ping"}`. A valid `pong` confirms a non-mutating, authenticated-origin transport round trip. It creates **no room, player, question, or account**.

The reusable checker is `script/public-party-smoke-contract.mjs`; `tests/public-party-smoke-contract.test.mjs` verifies actual committed page markers and deliberately broken response cases. Core CI and the manually triggered public-smoke workflow run these fixture tests.

## How to run after an explicitly approved deployment

1. Confirm the exact merged `main` SHA passed core CI, integrated Chromium/Firefox/WebKit and public party Chromium/Firefox/WebKit checks.
2. Confirm independent offsite recovery status under [#48](https://github.com/jimedusot-beep/Trivia-Lobby/issues/48), active protection under [#49](https://github.com/jimedusot-beep/Trivia-Lobby/issues/49), provider/environment status, change window and rollback SHA. Record owner approval of any release despite known gaps.
3. In GitHub [Actions → Public deployment smoke](https://github.com/jimedusot-beep/Trivia-Lobby/actions/workflows/public-smoke.yml), choose **Run workflow**, and enter the actual public HTTPS origin `https://trivia-lobby.onrender.com` (not the `/party/` path). The script checks both `/` and `/party/`.
4. Confirm run success, record the run URL, deployment SHA, Render deployment ID, timing, and any 4xx/5xx failure. A successful smoke may also be run against a disposable staging deployment before production.
5. On the actual host display and phones: verify QR invitation, one-screen controls, real Safari/Android Chrome if available, Quiz and another full game, scores, reconnect, host refresh, native TV fullscreen, Grand Prix 3D and 2D fallback, and 4→10→20 real-phone Wi-Fi progression. Record observed latency/frame gaps; **headless CI does not certify physical phone capacity**.

## Explicit limits

- A successful HTML response and asset markers do not guarantee that React or the guest UI rendered correctly at 320px or 1080p, nor that all 31 games are finishable. Use existing Playwright/engine tests plus device QA.
- A ping/pong on `/party/socket` confirms a live protocol route but **not** room creation, authorization, reconnect or multiplayer play.
- `/health/ready` confirms the configured database query, not independent recovery.
- A successful fixture restore or skipped production backup job is not proof of a real offsite archive. Issue #48 remains a separate release gate.
- Smoke does not provide continuous monitoring or failure alerts when no scheduled workflow runs; an approved external probe/notification is still needed.

## Release gate summary

| Gate | Required evidence | State from this PR alone |
| --- | --- | --- |
| Code and browser suites | All required jobs green at exact merged SHA | Not yet verified on proposed head |
| Guest HTML/assets/socket | Manual public smoke run against **deployed SHA** | Not run on production |
| Private data/backup restore | Independent real DB + original file recovery and access control | **Unverified**, see #48 |
| TV + phones | Real device full match, reconnect, no scrolling, race | **Unverified** |
| Deployment and rollback | Owner approval, exact commit mapping, checked rollback procedure | **Not performed** |

No live Render deployment, release approval, secrets, API/private data writes or paid service additions were made by this PR.
