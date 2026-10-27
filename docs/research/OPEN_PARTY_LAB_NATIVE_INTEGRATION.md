# Native Open Party Lab-inspired games inside Trivia Lobby

This feature branch implements **one new original playable game** and provides native-host links to **six original Trivia Lobby alternatives**. It does **not** import or run the 21 upstream game implementations; claiming otherwise would be inaccurate.

## Playable native game delivered

**Tap Dash** (`mode: tap`, original rules/controller, inspired by [Open Party Lab's Tap Race](https://github.com/Hartwich/tap-race)): 2–20 active phones, 3 heats of 12 seconds. Players join the **existing Trivia Lobby /party/** QR code/room; the existing signed guest identity and WebSocket route are reused. The host screen presents 20-person live progress; each phone has one accessible tap button and its own live tap/position readout. The server validates monotonic sequence IDs, rate-limits input to realistic tapping, closes invalid late/host taps, and awards each participant points in the **existing `Party.players[].score`** exactly once per heat. Tied positive totals share places and awards, while a player with no taps earns 0. The same room returns to the lobby and can host any other native game after the match. This is NOT Open Party Lab's `tap-race` code or artwork.

**Existing native game:** Party Grand Prix (`mode: race`) already implemented before this PR, uses 20 phone controllers with server-driven racing and the same room scoreboard. This is an original alternative to Open Party Lab's 4-player `drift-racer`, not a port of its game engine.

## Whole catalog crosswalk

The optional 21-entry Open Party Lab catalog displays links for these six **original Trivia Lobby alternatives** (not upstream copies):

| Upstream Open Party Lab concept | Original native Trivia Lobby alternative | Active phone capacity |
|---|---|---|
| Tap Race | Tap Dash (**new**) | 2–20 |
| Drift Racer | Party Grand Prix (existing) | 2–20 |
| Pantomime | Charades (existing) | 3–20 |
| Imposter | Secret Impostor (existing) | 3–20 |
| Zeichnen & Erraten | Doodle Dash (existing) | 2–20 |
| Schaetzorama | Closest Wins (existing, simpler estimation rules) | 3–20 |

These alternatives launch `./?game=<native mode>` on the **same Trivia Lobby host interface**. Users join by the existing QR invite and use its normal scoreboard. Upstream OPL player caps remain visible separately and never become 20-player claims for the original OPL code.

**Remaining upstream projects that are not integrated:** Magic Arena, Magic Duell, Air Hockey, Buzzwort, Light Trails, Word Tiles, Arena Survivor, MinionsTD, Chaos-Kommando, Schattenjagd, Flatterfluff, Dungeon Party, Kartentisch/Card Table, Blickwinkel and Dungeon-Gilde. These 15 still link to source and are not represented as playable native games. Existing Trivia Lobby card/manual table mechanics do not constitute ports of the individual upstream card-table rulesets.

## Game runtime, scoring and security

1. `open-pack/tap.js` has authoritative `openTap`, `acceptTapInput`, `finishTap`, `nextTap`, `tapFrame` and `projectTap` functions. It reuses `Party.enter()`, match IDs, round phases, player records and scores. Timeouts are server clock-driven.
2. `transport.js` recognizes **only** `tap_input` on an authenticated and currently playing tap room; each socket is independently limited to 18 tap packets/s, plus 75ms minimum accepted time between clicks. Invalid fields, sequence replays, impersonation and post-timeout inputs cannot add points. It sends a **100ms** small host/player-specific `tap_frame`, rather than multiplying full-room broadcasts per tap. The existing 20-person room limit and host/guest credentials apply unchanged.
3. `public/tap-ui.js` renders separate host and controller surfaces and doesn't simulate scoring. The button is focusable for keyboard or touch. Reload/reconnect seeds its sequence ID from the server's last accepted sequence, and only a valid connected socket sends actions.
4. All 24 original guest modes and the previously merged Grand Prix are preserved. New mode `tap` makes 26 native guest modes in the catalog. There is no database, cloud-streaming, account or billing change.

**Not provided:** score persistence across different game matches (existing `Party.handle(start)` resets scores per match), 21 original Open Party Lab builds in one runtime, exact code/asset ports, verified Raspberry Pi performance or a claim that this is deployed. Those require new feature work or explicit product decisions.

## Verification commands

- `cd examples/party-engine && npm test`: new unit tests, anti-replay and 20 real WebSocket QR participants.
- `cd examples/party-engine && npm run test:browser`: phone controller, QR join, reconnect and common host scoreboard, catalog links.
- `npm run check && npm run build`: existing TypeScript/build checks.
- Review CI before merge; real physical 10–20-phone acceptance is still required.

## Source and licensing

Reference: [Open Party Lab platform](https://github.com/Hartwich/Open-Party-Lab/tree/bb221f92d1b29afce1cd5b3953c7450612d52a71), [Tap Race](https://github.com/Hartwich/tap-race), [original catalog audit](OPEN_PARTY_LAB_CATALOG.md). No OPL runtime, source code, art, music or assets copied in this change. Game mechanics are original implementations inspired by broadly known tapping and scoring ideas. Review the license and rights separately before any future upstream source reuse.
