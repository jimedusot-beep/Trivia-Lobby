# REA Vault → Trivia Lobby integration (2026-10-25)

## Source and evidence
User-provided **Party Game REA Reference Vault** (44-page PDF). It supplies suggested gameplay patterns, toy WebSocket/Socket.IO code and unverified descriptions of proprietary games. It is *not* evidence that its example endpoints or payloads are real production APIs. No sample code, branding or third-party assets are copied into the implementation.

## Preserved baseline
Trivia Lobby already had credential-secured 6-character room codes, separate host/phone views, authoritative timers, reconnect identities, duplicate-answer defense, early reveal when all connected answer, a saved question library and six quiz modes. These remain in place; the `ws` transport is retained, not swapped for Socket.IO.

## Additions implemented
1. **Host-only submission tracker**, inspired by the PDF's "4/6 answers" presentation (pages 1–3). A strict versioned `SUBMISSION_PROGRESS` message carries only the question index and aggregate received/total/connected counts. It is never broadcast to players or tied to answer identity; updates on valid answers, question start and reconnections.
2. **Sprint Trivia mode**, inspired by the speed mechanic and timed question flow (PDF pages 1–3 and 37–44). Original configurable-mode scoring: a correct answer earns 500–1,000 points (before any authored question factor), decreasing with the server-recorded receipt interval. Wrong/missed answers score zero. Other scoring modes remain unchanged.
3. **Regression tests** for scoring bounds, host reconnect, duplicate input, progress privacy, and event shape.

## Deferred by design
- The PDF's `Math.random()` 4-character room codes and socket-ID identities are not used: weaker collision resistance and reconnection support.
- The example's wildcard CORS, host-less start/answer routes, and unconstrained motion actions are not used.
- Charades tilt gestures: requires phone-specific consent, calibration, input debounce, host authorization and accessibility fallback.
- Drawing, Codenames, Spyfall, Among Us and Mario Party: each requires dedicated roles, secret projections, input throttles, legal-content checks and game-mode tests.
- Trivia Crack category wheel: questions are deck-owned today; meaningful category routing needs reviewed per-question categories and fair selection, not invented labels.

## Verification and rollout
CI should execute `npm ci`, `npm run check`, `npm test`, `npm run build`, plus existing browser tests. This PR does **not** change production configuration, deploy the game, or introduce restart-safe rooms. Any claims of production readiness require real browser/phone tests and review.
