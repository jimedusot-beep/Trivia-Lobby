# Open Party Lab complete public game catalog

Status: **Browsable reference/companion catalog integrated; games are NOT imported into Trivia Lobby's guest runtime**.

This delivers the complete list of 21 optional public Open Party Lab game repositories, based on its `config/known-games.json` at pinned upstream platform commit `bb221f92d1b29afce1cd5b3953c7450612d52a71` (2026-10-16). The published `minPlayers`, `maxPlayers` and controller types were read from each game's `src/manifest.ts` on 2026-10-26.

- `examples/party-engine/public/open-party-lab-games.js`: original UI metadata, 21 source links and manifest player limits.
- `examples/party-engine/public/open-party-lab.html`: optional catalog shown from `Pick a Game`. Does **not** expose non-functional Host buttons.
- `open-party-lab-browser.js`, `open-party-lab.css`: client-side search, player-capacity filter, source links and responsive cards. The local launcher form only accepts user-entered loopback, private RFC1918 and `.local` HTTP(S) host URLs. It does not scan the LAN or store credentials.
- Guest engine, socket protocol, login/private study surfaces, existing 24 games and hosting are unchanged.

## How to actually play the games

On Windows, download Open Party Lab's maintained self-contained ZIP from [official releases](https://github.com/Hartwich/Open-Party-Lab/releases), extract it, then run its EXE. The upstream build bundles the game projects and Node runtime; the host laptop and phone browsers must share a network. The host shows its own room and QR invite. No cloud game streaming is required.

The Open Party Lab games **do not reuse** Trivia Lobby's room codes, scores, logins or lobby, and remain limited to their upstream manifest capacities. Example limits: Drift Racer 1–4, Tap Race 1–8, Imposter 3–20, Card Table 1–16, Magic Duell 2–2. A game advertising `maxPlayers:20` is **not** proof of a 20-device playtest. Open Party Lab itself warns that most games are alpha/beta.

For source use, the upstream README documents Node.js 20+, npm 10+, `npm ci`, `npm run games:clone-all`, `npm run build`, and Windows `npm run dev:all`. A fresh checkout does **not** include the separate game repos. The Raspberry Pi installation and game performance need independent testing; the Windows release is not a Pi binary.

## Remaining work before **native** 21-game support

1. Choose a shared adapter between the 21 independent upstream game protocols and Trivia Lobby's original raw-WebSocket guest party reducer; swapping in Open Party Lab's Socket.IO server is **not** equivalent to integrating a game.
2. Audit and pin the exact game-repository revisions, code licenses, assets, dependencies, notices and attribution separately. The platform's Apache-2.0 code license does not automatically clear all assets/games. No upstream code or artwork is copied in this PR.
3. Port or adapt each game separately (rules, timebase, actions, host render, controller, state projection, disconnects) or engineer a secure same-origin embedded sub-app; do not present the companion launcher as native integration.
4. Support spectator/teams/parallel arena modes where upstream game player caps are below 10–20; game design and server load must be independently validated.
5. Verify 10–20 simultaneous real phone clients on a single Node service and target Raspberry Pi/laptop, including actual input-to-display latency, 375px layouts, role controls, reconnects, room isolation, stopping held inputs, resource use and release rollback.
6. Review separately from the current pending production protections, offsite backups and real-device validation. Do not automatically merge or deploy.

## Validation

`cd examples/party-engine && npm test` includes `test/open-party-lab-catalog.test.js`. `npm run test:browser` includes `browser-specs/open-party-lab.spec.js` for catalog navigation, filtering, local-only host address validation and mobile viewport. Root `npm run build` copies the public catalog assets to `dist/party` through the existing static-copy step.

## Sources

- [Open Party Lab](https://github.com/Hartwich/Open-Party-Lab/tree/bb221f92d1b29afce1cd5b3953c7450612d52a71)
- [Game-repo index](https://github.com/Hartwich/Open-Party-Lab/blob/bb221f92d1b29afce1cd5b3953c7450612d52a71/config/known-games.json)
- [Architecture](https://github.com/Hartwich/Open-Party-Lab/blob/bb221f92d1b29afce1cd5b3953c7450612d52a71/docs/architecture.md)
- [Game SDK](https://github.com/Hartwich/Open-Party-Lab/blob/bb221f92d1b29afce1cd5b3953c7450612d52a71/docs/minigame-sdk.md)
- [Source and assets notice](https://github.com/Hartwich/Open-Party-Lab/blob/bb221f92d1b29afce1cd5b3953c7450612d52a71/NOTICE.md)

The catalog was generated from independently reviewed public metadata, with original text and no imported code, art, music or media.
