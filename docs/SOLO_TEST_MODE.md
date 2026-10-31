# Solo Test Mode — one tab, real game state

Use `/party/solo-test.html` from the game library to rehearse gameplay when no second phone or human is available.

## What it does

The browser creates one ordinary server-authoritative party room, connects a separate host session plus 2–5 **player WebSocket sessions** (you plus virtual rivals), and shows the actual host/TV area and a controllable player area on the **same page**. This is not a rule bypass: the normal 2–3 connected-player minimum and all existing action validation still apply.

The first version deliberately covers:
- **Trivia Quiz:** 3–5 seats (you plus 2–4 demo rivals). Select an answer from the player panel; rivals select choices automatically; use Next round on the host panel to continue.
- **Party Grand Prix:** 2–5 seats (you plus 1–4 demo rivals). See the existing Grand Prix host renderer; steer left/straight/right, toggle drift and use an item. The rival provides bounded steering inputs with steering assistance.
- **Tap Dash:** 2–5 seats (you plus 1–4 demo rivals). Tap your own button while the simulated rival sends bounded taps. Heats and results are still scored by the real server.

## Safety and restrictions

- No backend change, privileged protocol, player-count override, direct room state injection, imported private deck, account or external dependency.
- **Explicit opt-in**: ordinary guest play does not start virtual clients. The lab uses only the chosen three modes, not the full 31-game catalog.
- Stops or closes the sockets when leaving. A normal temporary room still exists until expiry; this is a test environment on the same public server, **not** an offline sandbox or a persistent bot service.
- Virtual rivals do not validate physical Bluetooth/tilt behavior, real phone readability, Wi-Fi performance, 10–20 human concurrency, or human gameplay quality.
- Sensitive data (join credentials, actor tokens) stay in JS memory only. No credentials are placed in the page or in links.
- Test scores belong only to the temporary test room and do not use the private quiz study system.

## Release checks

Browser tests cover one-tab room creation, real 3-player quiz with user answer, five-seat quiz setup, host render and steering controls for racing, responsive Tap Dash, and clean Stop. See [the open-source research shortlist](./SOLO_OPEN_SOURCE_RESEARCH.md) for future adapter and test-scenario work. The normal party catalog, hosting, joining and server validation remain unchanged. Do not deploy without passing browser acceptance and smoke tests.
