# Party Grand Prix: QR phones, one shared screen

## Contract (written before implementation)

Add one original overhead kart racer to the existing guest game catalog. A host
opens the shared track on a computer/TV; 2–20 nickname-only guests scan the same
existing QR invitation and receive phone controllers. Every admitted guest races.
No account, phone installation, proprietary character assets, new service, or
database is required. This is a browser adaptation, not an embedded native game.

Three heats share the same roster and championship points. Each heat has three
laps and a 60-second maximum; after the first natural finish the remaining racers
have at most 15 seconds. The host advances between heats and can end the match.
Controls are automatic acceleration, left/right steering, hold/release drift and
one item button. A visible driving-assistance toggle helps beginners. One shared
overhead camera keeps all 20 karts visible. Phone controllers identify the player's
number/color, position, lap, drift charge, item and connection status.

## Authority, transport and failure behavior

- The existing authenticated guest WebSocket owns player identity. Only finite,
  bounded steering and boolean buttons are accepted; clients never supply
  position, speed, lap, item awards or scores.
- Inputs carry match ID, heat index and monotonic sequence. Replaced sockets,
  old heats, duplicate/reordered inputs, unknown fields and host driving fail.
- Physics uses a fixed 50 ms server step with bounded catch-up. Frames are sent
  at 10 Hz; the host receives public positions and each controller only its own
  driving status. Normal party action limits remain unchanged; racing has its
  own bounded input budget and a four-active-race-room limit.
- Missing input or disconnection hands steering to computer assistance. Valid
  resumed credentials reclaim the same kart and score. A hidden/blurred
  controller releases held buttons. A stalled host connection cannot freeze the
  authoritative simulation. Existing room expiry and restart limits still apply:
  process-restart durability remains the separate, unmerged PR #66.
- Heat scoring is applied once by the server. Clients cannot claim progress or
  replay item actions to gain points. Return to lobby preserves the room and
  allows another existing game to start.

## Bounded source investigation and reuse

1. `bridge-mind/turbo-kart-rush`, revision
   `6c0456c7642447eae29e0832e7e542fec07ec07d`, MIT: `src/core/math.ts`
   (selected damping, angle and track-wrap helpers) and `src/kart/Kart.ts`
   (three-tier drift thresholds and boost-duration tuning). These small pieces
   are intentionally adapted; its Three.js scene, commercial-style item names,
   character art and single-player runtime are not copied.
2. `greggman/HappyFunTimes`, revision
   `da2ba35511cfc657de9dfbbc7fca0d3aa7d89ef0`, BSD-3-Clause: documented one
   shared display plus private browser controller architecture. Reference only;
   the deprecated LAN/server library is not installed or copied. The existing
   Trivia Lobby guest transport supplies rooms, QR invitations and credentials.

Exact revisions and reuse scope belong in `docs/OPEN_GAME_SOURCES.json`; notices
and this build's corresponding source are available through the existing credits
page. All track, kart, item and UI drawings are original Canvas/CSS work.

## Acceptance

- Deterministic full heats: progress through ordered track checkpoints, natural
  finish and timeout, drift boosts, item consumption, collisions, takeover,
  championship scoring, next heat and same-room return.
- Reject malformed/spoofed/stale input; preserve ordinary game rate limits and
  prevent a controller from obtaining a host projection or replacing identity.
- Real local WebSockets with 10 and 20 controllers: sustained inputs, shared-IP
  joining, frame size/throughput, host/guest reload and takeover/reclaim.
- Browser: decode the displayed QR and join on a phone viewport; multitouch and
  keyboard steering/drift/item, input release, visible status, reconnect and host
  recovery; no horizontal overflow at 320 px; existing modes remain playable.
- Run root TypeScript/tests/build, guest engine/network suite, and relevant
  Chromium/Firefox/WebKit acceptance. Record real outcomes below before delivery.

Automated browsers and sockets do not establish a 20-physical-phone/Wi-Fi pilot.
Merge, deployment and physical-device acceptance are separate delivery states.

## Verification record

The initial implementation was merged in
[PR #68](https://github.com/jimedusot-beep/Trivia-Lobby/pull/68). A focused
post-merge follow-up corrects the catalog/source acceptance expectations and
checks landscape controller placement. Its PR records final CI outcomes and
TV/controller screenshots. No physical-device pass is claimed.

Local verification:

- `npm run check`, 75 application tests, production build and license inventory
  pass; `npm audit --audit-level=moderate` reports zero vulnerabilities.
- All 146 guest engine/network tests pass. This includes full three-heat
  20-kart championships, drift/item behavior, bounded catch-up, malformed/stale
  controls, per-actor projections, rate/admission limits and same-room return.
- Ten and twenty real local WebSocket controllers sustain 20 Hz inputs for
  three seconds (600 and 1,200 input frames respectively), with both host and
  player socket replacement, recovery and no valid-input errors.
- A separate four-room/80-kart, 60-second simulation completed all 80 natural
  finishes. Local simulation work per 50 ms tick measured about 1.6 ms at the
  95th percentile, 5.5 ms maximum. This is a local measurement, not a Render
  latency, network or physical-device guarantee.
- Regular local Chrome is blocked by the environment's process socket
  restriction. Google's official headless shell runs successfully: six targeted
  Chromium cases pass, including the repaired source/catalog checks, portrait
  and landscape controls, independent touches, 20 controllers with reload, and
  heat/results/same-room return. The initial CI run passed all racing scenarios
  in Chromium, Firefox and WebKit; only the older catalog/source counts failed.
  Consult the follow-up PR for final full-suite outcomes.

## Playing the feature

On the shared computer/TV, choose **Host Party Grand Prix** from Pick a Game.
Players scan its QR invitation, enter nicknames and keep their controller pages
open. The host starts with 2–20 connected players. Each phone shows its numbered
kart, steering, drift, item and assistance control; the TV shows every racer.
After a heat, the host chooses **Next**; after the championship, **Return to same
party** retains the room for another game.

For a local installation, follow the standalone engine's Node 22+ instructions,
listen with `HOST=0.0.0.0`, and open the host computer's LAN IP in its browser
before sharing the QR. A localhost URL cannot be opened by another phone.
Keep the host and phones on a Wi-Fi network that allows devices to communicate.

Physical 20-phone acceptance, process-restart recovery (#66), merge and production
deployment remain separate from these automated tests. The PR is the authoritative
delivery-status record.
