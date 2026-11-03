# GX2 optional sound and visual-feedback toolkit

**Scope:** isolated, opt-in browser module in \`gx2-feedback.js\`; **no host, game, server, phone, WebSocket, scoring or protocol integration** in this change. Read issue #102 for eventual integration ownership. Standalone preview: \`/party/gx2-feedback-demo.html\` in the existing Render static route, or \`/gx2-feedback-demo.html\` when running the standalone party server. Demo is not linked from the public game shelf.

## Public API

\`\`\`js
import {createFeedbackToolkit} from "./gx2-feedback.js";
const feedback = createFeedbackToolkit({output: document.querySelector("#visual-status")});
const enable = document.querySelector("#enable-sounds");
enable.addEventListener("click", async () => {
  const available = await feedback.unlock(); // MUST be a direct real user gesture
  if (available) feedback.setMuted(false); // additional explicit opt-in
});
feedback.beginRound("room-id:match-id:round-3");
feedback.play("correct", {eventId:"server-ack-123",roundId:"room-id:match-id:round-3"});
// On phase/match change, and on leaving the page:
feedback.beginRound("room-id:match-id:round-4");
await feedback.dispose();
\`\`\`

Cues: \`confirm\`, \`countdown\`, \`cardFlip\`, \`raceBoost\`, \`correct\`, \`incorrect\`, \`victory\`. Exports: \`feedbackCues\`, \`feedbackLabels\`, \`createFeedbackToolkit\`.

\`state()\` returns mute, volume, lowPower, unlocked, round, disposed and bounded voice/ID counts. \`unlock()\` only resumes audio when invoked by the user; no audio plays on construction or unlocking. \`setMuted(boolean)\`, \`setVolume(0..1)\`, and \`setLowPower(boolean)\` persist optional preferences under a versioned localStorage key; their getters/writes fail safely in private/restricted browser contexts. The module defaults to muted. \`beginRound(string)\` clears event IDs, active tones and visual timers. \`play(cue,{eventId,roundId})\` rejects duplicate IDs and stale rounds and returns \`{accepted,sounded}\`; even when muted, valid cues may display visual feedback. \`dispose()\` is idempotent and closes AudioContext, cancels all tones and visual timers.

Low-power preference or \`navigator.connection.saveData\` suppresses audio and animation; \`prefers-reduced-motion\` suppresses visual animation. Active tones are bounded to 20 and remembered IDs to 128. The optional output element is populated via textContent (no HTML). There are no remote requests, third-party media, analytics, autoplay or code dependencies. All sound is synthesized from original low-volume oscillator frequencies. **Audio asset size: 0 bytes; imported external sound assets: none.** Existing \`client/src/lib/game-audio.ts\` was reviewed but not edited.

## Testing and handoff

- \`cd examples/party-engine && npm test\` includes \`test/gx2-feedback.test.js\`: locked/unlocked audio, mute persistence, no surprise audio, duplicated/replayed events, stale round, memory bounds, restricted storage, reduced/low-power output, disposal.
- \`PARTY_CROSS_BROWSER=1 npm run test:browser -- --project=chromium --project=firefox --project=webkit\` includes \`browser-specs/gx2-feedback.spec.js\`: real accessible controls, demo persistence, visual-only mode and reduced animation.
- The root CI and existing party engine gameplay/browser suites must still pass before merging.

To integrate later, use an isolated adapter owned by the affected game/host UX maintainers. Never generate event IDs from local non-authoritative scores or translate network action types. Do not play in response to reconnect replay; use real server event IDs and match-round IDs. Physical iOS/Android/TV, speaker volume, and audio latency are **not tested** by headless browser CI.
