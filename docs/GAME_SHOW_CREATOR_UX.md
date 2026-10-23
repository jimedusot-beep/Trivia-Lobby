# Live game-show and quiz-creator usability improvements

This is independently authored Trivia Lobby UI work. Audio cues are synthesized with Web Audio; no third-party sounds, artwork or hidden Kahoot implementation was used.

## Presenter and player improvements

- The host can opt into short original sounds and turn them off again; audio remains off by default and is never necessary for gameplay.
- Countdown beeps sound only in the final five seconds. Reveal and finish cues are tied to server-authoritative state transitions, not local scoring.
- Fullscreen presenter mode is an explicit host action, with a button to exit; a browser that disallows fullscreen can still host normally.
- Host and player screens display question progress as X of Y using a public, optional `totalQuestions` wire field. Existing protocol version 1 remains backward-compatible.
- The host shows connected/disconnected lobby members, mobile web sharing uses the native Share API where available and otherwise falls back to clipboard.
- Reduced-motion preferences suppress the host's extra motion while player confetti already honors `prefers-reduced-motion`.

## Advanced question-bank usability

- The creator offers prompt/tag search and type/live-playability filters.
- When a filter is active, reorder controls disable to avoid writing an unintended order.
- Duplicate creates a separate saved question with a unique copy suffix and retains original answer settings, source attribution and timer.
- Authenticated question preview explicitly hides answer keys, source evidence and explanations and renders answer controls for the currently live-compatible types.
- Existing edit/create/delete, review-draft and ownership behaviors are preserved.

## Intentional limits / next work

- Sounds can be blocked by restrictive browsers. Visual feedback is always the source of truth.
- `QuestionPreview` is a non-interactive authoring preview; live scoring remains server-authoritative. The browser E2E must pass before production release.
- QR generation, media questions, multiple host editors, public discovery, persistent live-room authority and deployment monitoring are not included.
- This feature branch is stacked on PR #29 (assignments), which is stacked on #28 (reports) and #27 (mixed live engine). Merge in dependency order. PR #26 adds separate historical retention work.
- Retest across mobile browsers and with a real keyboard/screen reader before release; automated tests are not a complete accessibility audit.
