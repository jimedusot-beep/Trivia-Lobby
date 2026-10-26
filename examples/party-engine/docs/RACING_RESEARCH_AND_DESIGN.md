# Original 20-player racing experiments — Turbo Circuit and Wave Sprint

This feature is a **lightweight, original browser implementation**, not a port, recompilation, mirror, or ROM loader for Nintendo or PlayStation titles.

## Experience

- **Turbo Circuit:** three-lane kart sprint, cones, GAS/coast, lane changes and a 2.5-second boost with a 12.5-second cooldown.
- **Wave Sprint:** three-lane water sprint with wave-marked hazards, lightweight speed variation, the same boost and touch-first controls.
- **10–20-person family sessions:** use the existing temporary guest QR-code room, nicknames and host display. All 20 can race simultaneously; minimum is 3.
- **Shared host display:** shows the course, finish line, movement and standing. Phones show personal lane/GAS/BOOST inputs. Each race is limited to 90 seconds, then awards bounded server-computed points based on finish time or distance.
- **Reconnects:** existing cryptographic room credentials recover the same racer and ongoing scores. A disconnected racer loses acceleration but retains distance and elapsed match time.
- **Accessibility:** buttons provide accessible lane, GAS and boost controls; the view has SVG labels and a textual ranking, with no dependence on aiming or high-speed gestures.

## Trust and performance

- The browser sends only `play: {action:"drive",lane:0|1|2,gas:boolean,boost:boolean}`. The host can send only `{action:"end-match"}`; no submitted `score`, `distance` or `finishedAt` values are accepted.
- The server advances positions using its own wall clock and caps physics steps; server-generated obstacles, collision penalties, cooldowns, and result ordering are never trusted from player input. One completed match gives exactly one payout. Input messages are bounded in size and limited per player to at most roughly five per second.
- One shared room-level timer publishes position snapshots at **750 ms**, avoiding a separate high-frequency simulator on 20 phones.
- Game state lives in the current process and is lost on server restart; persisted race rooms and actual cloud performance guarantees are **not included**.
- This is *arcade lane racing*, not a full 3D physics port. Rendering is local SVG and CSS, with no new dependencies, paid services, copyrighted tracks or assets.
- A real 10–20-device test on Wi-Fi/4G remains necessary before live deployment.

## Research references and reuse

| Existing project | License / condition | What was studied | Integration decision |
| --- | --- | --- | --- |
| [Clearwater Jetski](https://github.com/cghub7/clearwater_jetski) | MIT; requires preserving copyright and MIT notice if code is copied | Touch throttle/steering UX, handling and race feel. Its WebGL2 water requires suitable GPU capabilities. | **No source or graphical assets copied**; original lighter water lane mode |
| [CTR: High Octane](https://github.com/Rinnegatamante/CTR-High-Octane) | GPL-3.0 project; requires a user-supplied original PS1 disc dump | Fun local arcade kart feel | Research reference only; not embedded or redistributed |
| [SpaghettiKart](https://github.com/HarbourMasters/SpaghettiKart) | User-supplied supported US Mario Kart 64 ROM required; no game assets shipped in the port | Retro kart accessibility and game modes | Not bundled or used as a source-code dependency |
| [Wave Race 64 Recompiled](https://github.com/elliotttate/wave-race-64-recomp) | User-supplied supported ROM required | Water racing presentation | Research reference only; not bundled or used as a source-code dependency |

For features from the console-era games, create independent game designs and original art instead of bundling game files.

## Review and regression checks

- `cd examples/party-engine && npm test && npm run test:browser`
- `npm run check && npm test && npm run build && npm run test:production` and integrated Chromium/Firefox/WebKit pipeline
- 3/10/20-player races; forged scores/roles; duplicate actions; rate limiting, spectator privacy; host early stop; deadline; recorded scores; phone QR scan and reconnection; original mode regression
- Merge only after checks and independent review, then verify production backups and the Render deployment separately.

### Tradeoffs to evaluate after the pilot

The 3-lane controls are intentionally simple and robust for family groups; possible follow-ups include a more curved racecourse, obstacle telegraphing, shorter configurable race duration, a touch joystick and spectator-friendly split rankings. Do not replace live controls with graphics-intensive 3D physics until network and accessibility testing justify it.
