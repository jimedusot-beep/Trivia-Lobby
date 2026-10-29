# Game Experience 2.0: source and license audit

Audit date: 2026-10-29. Baseline: `55414cd7d3f8cc903897f5d40f3d0e914aea579b`.
Documentation only: no imported code/assets, license changes, merge or deployment.
PR #94 is the integration plan; #93 remains open for tilt. Reliability PRs #81–84 remain separate.

## Decisions and release blockers

1. **Corresponding-source completeness needs integration review before release.** `script/build-game-sources.mjs` publishes guest files and a few root files, including `server/guest-party.ts`, but omits its checkpoint implementation and other integrated server/client/shared sources. The root build command advertised inside the JSON cannot be reproduced from that JSON alone. A pinned complete GitHub source link is also offered, so this is a bundle completeness finding, not a determination of legal noncompliance. Verify anonymous access to the complete deployed revision, required build inputs, installation instructions and actual production endpoints before release. Agent 00 should coordinate a separate minimal build/source fix or make the standalone scope explicit. Do not publish secrets or private user data.
2. **License boundary needs qualified review.** Root `package.json` says MIT; many guest files say AGPL-3.0-or-later; the boards manifest says the ambiguous `AGPL-3.0`. These facts do not establish that the combined program can be MIT-only or that an upstream grant permits “or later.” Reading the AGPL license text alone cannot settle the grant/version election. Retain notices; review upstream file-level grants, modification notices/dates, scope of the combined work, UI legal notices and corresponding-source obligations (especially sections 1, 5, 6, 13). No blanket relicensing proposed.
3. **Quaternius is B: no new imports.** The [current license](https://quaternius.com/license.html), dated 2026-08-28, is QAL v1.0 with restrictions on standalone asset redistribution. The [FAQ](https://quaternius.com/faq.html) still says CC0. Do not infer CC0 for new downloads from older notes. Preserve proof of the specific pack/version/acquisition terms; previously acquired CC0 material requires that evidence. Resolve conflicting terms before putting source assets in a public repository. QAL has no SPDX identifier assumed here.
4. **An npm scan is not compliance approval.** `npm run audit:licenses` scanned 284 production lock entries with no flagged metadata. It excludes dev dependencies, does not audit the standalone lockfile, copied source, separate art/audio/fonts, actual notice inclusion or source completeness. Its `reviewRequired: false` must not close items 1–3.

## Existing adaptation inventory

Every revision below is the full SHA in `OPEN_GAME_SOURCES.json`. Upstream license files were retrieved at those exact revisions on the audit date; existing notices remain unchanged. This checks license evidence, not an exhaustive source similarity or ownership investigation.

| Manifest ID | Verified upstream license path | Scope and preservation |
| --- | --- | --- |
| race | bridge-mind/turbo-kart-rush `LICENSE`, MIT | Existing math/drift adaptation; retain BridgeMind copyright and permission text. No upstream art/music approved. |
| phone-controllers | greggman/HappyFunTimes `LICENSE.md`, BSD-3-Clause | Architecture reference only; preserve reference. No deprecated transport import. |
| feud | joshzcold/Friendly-Feud `LICENSE`, MIT | Flow reference only; no survey bank or branding approval. |
| draw | scribble-rs/scribble.rs `LICENSE`, BSD-3-Clause | Reference only currently; copied code would require copyright, conditions, disclaimer and no endorsement. |
| cards | tanmay-tiwari-20/Unoverse `LICENSE`, MIT | Existing deck/turn/scoring adaptations; retain Tanmay Tiwari notice. |
| boards | freeboardgames/FreeBoardGames.org `LICENSE`, AGPL v3 text | Actual rule adaptations in `open-pack/board-rules.js`; source/combined-work review remains a release gate. |
| table | ArnoldSmith86/virtualtabletop `LICENSE`, GPL v3 text | Interaction model reference only; do not import upstream game packs, art or GPL code without scope review. |
| trivia | Ralex91/Razzia `LICENSE`, MIT | Schema interoperability only; no question-bank approval. |
| race-3d-reference | fecolinhares/super-kart-3djs `LICENSE`, MIT | Renderer initialization adaptation only; preserve Feco Linhares notice. Models, tracks, audio and brand assets not covered by this approval. |
| three | mrdoob/three.js `LICENSE`, MIT | Pinned 0.180.0; retain three.js authors notice in distributed renderer. |

For each row, the immutable URL is `<repository>/blob/<commit>/<license path>` using the existing manifest fields. All ten local notice files are published. `chess.js` 1.4.0 BSD-2-Clause notice is separately copied by the build. Fredoka and Nunito OFL texts exist in both public license directories; font binary/notice packaging remains part of each release audit.

## Scouting decisions and bounded menu

Class A means eligible for a bounded reuse **subject to** preservation and per-file review; it is not approval to copy a whole repository. Class B means reference only until missing evidence/scope review is completed. Class C means unsuitable for this integration. Immutable code pins and license URLs for new candidates are in `GX2_SOURCE_CANDIDATES.json`; they are deliberately separate from shipped credits.

| Candidate | Class | Agent menu and conditions |
| --- | --- | --- |
| Super Kart 3DJS | A code / B assets | Agent 01: selected MIT rendering ideas/helpers at existing pin; retain notice. No upstream assets until independently licensed. Keep original simulation and transport. |
| Kenney [Racing Kit](https://kenney.nl/assets/racing-kit) | A after archive check | Agent 01: official page identifies CC0, release 1.0; record downloaded archive hash, internal license and exact selected filenames before import. |
| Kenney [Car Kit](https://kenney.nl/assets/car-kit) | A after archive check | Agent 01: official page identifies CC0, version 3.1; same archive/filename requirements. |
| Kenney [Board Game Pack](https://kenney.nl/assets/boardgame-pack) | A after archive check | Agent 06: official page identifies CC0; exact archive version/hash still unverified. No file imports yet. |
| Kenney [Interface Sounds](https://kenney.nl/assets/interface-sounds), [Casino Audio](https://kenney.nl/assets/casino-audio) | A after archive check | Agent 07: official pages identify CC0, versions 1.0 / 1.1 respectively. Record clip filenames and transformations; archive licenses/hashes not yet inspected. |
| Quaternius | B | Agents 01/02/06: no assets cleared because current QAL/FAQ terms conflict. Use original geometry or verified Kenney material instead. |
| MATAH (IACBI/matah) | A selected code / B content | Agents 02/04: pinned MIT UI code eligible with notice and file-level check. Do not copy trivia/prompts/art on the strength of the root license alone. No second room/server/Redis stack. |
| Wemble Guys (grep-many/wemble-guys) | B overall; C full runtime transplant | Study visual staging only for now. MIT code verified, but GLB/HDR/MP3 origin/license not verified; Playroomkit P2P authority conflicts with existing server authority. No stack or asset import. |
| Phaser | A code; C engine replacement in this wave | MIT verified at pin. Optional isolated renderer work requires Agent 00 approval of size/API impact; no replacement of current Three.js/2D renderer or server. Phaser examples/assets require their own review. |
| boardgame.io | A code; C second game server | MIT verified at pin; study state/turn presentation patterns. Do not add its match server or scoring authority. |
| scribble.rs | A code / B assets | Agent 05: BSD-3-Clause bounded canvas presentation helpers with retained notice; no word-bank/art import without evidence. Existing implementation remains original. |
| Skribble.io clone (yashkhatri012/skribble.io) | B pending per-file/NOTICE and asset audit | Apache-2.0 verified at pin. Agent 05 may study UX; before copying preserve license, applicable NOTICE and copyright, mark modified files, review patent terms and separate assets. Not the proprietary skribbl.io service. |

Agents 03 and 08 need no third-party imports: original controller ergonomics and test/measurement work. Agents 04–06 must preserve private words, answers and cards. “Reference only” does not mean copying is permitted without attribution or terms review.

## Verified source delivery and limits

The generated source snapshot contains 180 files and baseline SHA. A local real-HTTP check against `createPartyServer()` returned 200 for `sources.html`, `sources.js`, `open-source/source.json`, `credits.json` and all ten manifest notices: **14/14**. Credits identify exact upstream revisions; source page links to the snapshot, AGPL text and complete repository. The standalone entrypoint regenerates source before listening; production root build invokes the same generator and serves `/party` static assets. This establishes local artifact availability, not production access or browser rendering. The HTTP check confirmed `shared/schema.ts` and `server/room-checkpoints.ts` absent from the JSON.

No deployed URL was tested or changed. Source bundles generated with a dirty worktree can carry HEAD while containing uncommitted content; release automation should use a clean tree and match build SHA to public source. Current audit documents are not new shipped adaptations and are not added to the runtime manifest.

## Import and release checklist

- [ ] Pin repository/release and full revision, or asset pack version plus SHA-256 archive hash.
- [ ] Retain exact license evidence and copyright/NOTICE files; distinguish code, art, sound, fonts and data.
- [ ] Record selected upstream paths, local destination paths, changes and responsible agent.
- [ ] Identify actual SPDX grant/version; do not infer “or later” from generic GPL/AGPL text.
- [ ] Update shipped manifest and published notices only for actual new use; reference candidates stay separate.
- [ ] Check dependency notices in built bundles and downloadable distributions, including standalone/dev build inputs.
- [ ] Verify complete source/build at exact deployed SHA anonymously, and host plus phone routes to credits.
- [ ] Resolve corresponding-source and combined-work questions with qualified review before release.
- [ ] Exclude commercial characters, logos, music, tracks, ROMs and unverified question banks.
- [ ] Keep PR-only scope; Agent 00 coordinates shared build/UI changes and release approval.

## Integration handoff

Owned files: this report and `GX2_SOURCE_CANDIDATES.json` only. No dependencies, runtime APIs, visuals or performance behavior changed. `OPEN_GAME_SOURCES.json` and production notices retain existing identity and claims; candidates are not falsely credited as shipped. Apply independently of #94 and #93. Rollback is a documentation revert. Before/after: previously scattered manifest/notice records; now bounded reuse decisions, immutable candidate pins and explicit release blockers. No screenshots or frame-time comparison applies to this documentation-only change. Browser/database/physical-phone suites and production verification remain unrun.

## Validation record

Local Node 24.22.1 (CI uses Node 22). Commands run on unchanged runtime:

| Command/check | Result |
| --- | --- |
| `npm run audit:licenses` | 284 packages; zero metadata flags; inventory regenerated without tracked changes |
| `npm run check` | Passed |
| `npm test` | 111 passed, 0 failed, 0 skipped |
| `cd examples/party-engine && npm test` | 253 passed, 0 failed, 0 skipped |
| `npm run build` | Passed; existing large-chunk and unresolved-at-build `/party/sakura-vista.svg` warnings |
| Local source/credits HTTP probe | 14 passed, 0 failed; 180 source files; omissions recorded above |
| Candidate JSON structure/pins | 5 entries, all full 40-character revision pins |

Full browser suites, database integration, physical devices and deployed source endpoints were not tested for this documentation-only PR. No production readiness claim.
