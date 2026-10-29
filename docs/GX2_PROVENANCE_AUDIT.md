# Game Experience 2.0: source and license audit

Audit date: 2026-10-29. Baseline: `55414cd7d3f8cc903897f5d40f3d0e914aea579b`.
Documentation only: no imported code/assets, license changes, merge or deployment.
PR #94 is the integration plan; #93 remains open for tilt. Reliability PRs #81–84 remain separate.

## Decisions and release blockers

1. **Corresponding-source completeness needs integration review before release.** `script/build-game-sources.mjs` publishes guest files and a few root files, including `server/guest-party.ts`, but omits its checkpoint implementation and other integrated server/client/shared sources. The root build command advertised inside the JSON cannot be reproduced from that JSON alone. A pinned complete GitHub source link is also offered, so this is a bundle completeness finding, not a determination of legal noncompliance. Verify anonymous access to the complete deployed revision, required build inputs, installation instructions and actual production endpoints before release. Agent 00 should coordinate a separate minimal build/source fix or make the standalone scope explicit. Do not publish secrets or private user data.
2. **License boundary needs qualified review.** Root `package.json` says MIT; many guest files say AGPL-3.0-or-later; the boards manifest says the ambiguous `AGPL-3.0`. Follow-up inspection found explicit `AGPL-3.0-or-later` declarations in upstream root and web package metadata at the pinned revision (links below), supporting that version choice. This resolves the metadata evidence gap; it does not establish that the combined program can be MIT-only. Reading generic license text alone would not have settled the grant/version election. Retain notices; review upstream file-level grants, modification notices/dates, scope of the combined work, UI legal notices and corresponding-source obligations (especially sections 1, 5, 6, 13). No blanket relicensing proposed.
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
| boards | freeboardgames/FreeBoardGames.org `LICENSE` plus root/web `package.json`, AGPL-3.0-or-later metadata | Actual rule adaptations in `open-pack/board-rules.js`; source/combined-work review remains a release gate. |
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
| Kenney [Racing Kit](https://kenney.nl/assets/racing-kit) | A verified archive | Agent 01: downloaded archive identifies Racing Kit 2.0 and CC0, correcting the earlier page-based 1.0 note. Hash, notice and selected GLB files recorded in `GX2_VERIFIED_ASSET_ARCHIVES.json`. |
| Kenney [Car Kit](https://kenney.nl/assets/car-kit) | A verified archive | Agent 01: archive notice confirms CC0, version 3.1; kart and wheel GLBs hashed in the verified-archive inventory. |
| Kenney [Board Game Pack](https://kenney.nl/assets/boardgame-pack) | A verified archive | Agent 06: archive notice confirms Boardgame pack v2 and CC0; selected chip image and card sound hashed. No production import. |
| Kenney [Interface Sounds](https://kenney.nl/assets/interface-sounds), [Casino Audio](https://kenney.nl/assets/casino-audio) | A verified archive | Agent 07: archive notices confirm CC0, versions 1.0 / 1.1 respectively. Selected clip filenames and hashes recorded. Importer must record transformations and local destinations. |
| Quaternius | B | Agents 01/02/06: no assets cleared because current QAL/FAQ terms conflict. Use original geometry or verified Kenney material instead. |
| MATAH (IACBI/matah) | A selected code / B content | Agents 02/04: pinned MIT UI code eligible with notice and file-level check. Do not copy trivia/prompts/art on the strength of the root license alone. No second room/server/Redis stack. |
| Wemble Guys (grep-many/wemble-guys) | B overall; C full runtime transplant | Study visual staging only for now. MIT code verified, but GLB/HDR/MP3 origin/license not verified; Playroomkit P2P authority conflicts with existing server authority. No stack or asset import. |
| Phaser | A code; C engine replacement in this wave | MIT verified at pin. Optional isolated renderer work requires Agent 00 approval of size/API impact; no replacement of current Three.js/2D renderer or server. Phaser examples/assets require their own review. |
| boardgame.io | A code; C second game server | MIT verified at pin; study state/turn presentation patterns. Do not add its match server or scoring authority. |
| scribble.rs | A code / B assets | Agent 05: BSD-3-Clause bounded canvas presentation helpers with retained notice; no word-bank/art import without evidence. Existing implementation remains original. |
| Skribble.io clone (yashkhatri012/skribble.io) | A bounded canvas code / B assets | Apache-2.0 verified at pin. Follow-up reviewed `client/src/utils/drawLine.js` and `client/src/hooks/useCanvas.js`: no separate notices in those files, and no NOTICE/license exceptions found in the complete pinned tree listing. These two files are eligible with license preservation and modification notices; do not transplant their Socket.IO lifecycle or trust unbounded stroke state. Other files and assets remain unapproved. Not the proprietary skribbl.io service. |

Agents 03 and 08 need no third-party imports: original controller ergonomics and test/measurement work. Agents 04–06 must preserve private words, answers and cards. “Reference only” does not mean copying is permitted without attribution or terms review.

## Verified source delivery and limits

The generated source snapshot contains 180 files and baseline SHA. A local real-HTTP check against `createPartyServer()` returned 200 for `sources.html`, `sources.js`, `open-source/source.json`, `credits.json` and all ten manifest notices: **14/14**. Credits identify exact upstream revisions; source page links to the snapshot, AGPL text and complete repository. The standalone entrypoint regenerates source before listening; production root build invokes the same generator and serves `/party` static assets. This establishes local artifact availability, not production access or browser rendering. The HTTP check confirmed `shared/schema.ts` and `server/room-checkpoints.ts` absent from the JSON.

At the initial audit stage no deployed URL had been tested or changed; the read-only live follow-up below supersedes that testing limitation. No deployment was changed. Source bundles generated with a dirty worktree can carry HEAD while containing uncommitted content; release automation should use a clean tree and match build SHA to public source. Current audit documents are not new shipped adaptations and are not added to the runtime manifest.

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

Owned files: this report, `GX2_SOURCE_CANDIDATES.json`, `GX2_VERIFIED_ASSET_ARCHIVES.json`, follow-up `GX2_LIVE_SOURCE_VERIFICATION.json`, and one verified upstream license notice for PR #96 integration. No game logic changes. No dependencies, runtime APIs, visuals or performance behavior changed. `OPEN_GAME_SOURCES.json` and production notices retain existing identity and claims; candidates are not falsely credited as shipped. Apply independently of #94 and #93. Rollback is a documentation revert. Before/after: previously scattered manifest/notice records; now bounded reuse decisions, immutable candidate pins and explicit release blockers. No screenshots or frame-time comparison applies to this documentation-only change. Browser/database/physical-phone suites remain unrun; read-only production source verification is recorded below.

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

At initial validation, full browser suites, database integration, physical devices and deployed source endpoints were not tested. The later read-only source verification below supersedes only the endpoint limitation. No production readiness claim.

## Follow-up evidence: archive and grant verification

Five official Kenney download archives were inspected on 2026-10-29. `GX2_VERIFIED_ASSET_ARCHIVES.json` retains complete internal license notices, SHA-256 archive hashes, byte sizes, archive versions and 11 exact candidate file hashes/sizes. This supersedes the initial page-only Kenney checks. No signed download links, ZIP binaries or extracted assets enter this PR. To reproduce, open each recorded official page, use its free download, hash the ZIP and compare the recorded notice and candidate members. Different hashes require a fresh check. Kenney credit is optional under the archive notices; keeping provenance and the notice in this project is still required by our workflow.

The archived asset menus now support Agent 01 (kart/wheel/barrier GLBs), Agent 06 (chip sprite/card sound), and Agent 07 (interface/card/chip OGGs). These are license candidates, not visual, performance, audio-quality or loading-size acceptance. Agents must select what fits, record actual local destinations and transformations, and publish credits for actual imports. Model textures/materials and any conversion outputs must stay traceable to the same verified archive.

Upstream FreeBoardGames grant evidence at the existing pin:

- [Root package declaration](https://github.com/freeboardgames/FreeBoardGames.org/blob/41a0077b7e76c1050b28f67537f00705a9095ed5/package.json): explicit AGPL-3.0-or-later.
- [Web package declaration](https://github.com/freeboardgames/FreeBoardGames.org/blob/41a0077b7e76c1050b28f67537f00705a9095ed5/web/package.json): explicit AGPL-3.0-or-later.
- Inspected `web/src/games/fourinarow/game.ts`, `mancala/game.ts`, `checkers/game.ts`; no file-specific contrary grant visible. Tree listing reports one root LICENSE and no nested license files. This supports the recorded version choice; it is not an exhaustive copyright/title opinion. Agent 00 can normalize the shipped manifest's ambiguous SPDX string in its coordinated notice patch.

Skribble clone follow-up is limited to the two canvas files named in the menu. The pinned recursive tree was not truncated and contained only root LICENSE among license/NOTICE-named entries. Agent 05 should retain Apache-2.0 and mark modifications if copying substantive code. The simple line helper requires no networking adoption; the larger hook is an example to adapt carefully, not a safe drop-in replacement for Trivia Lobby's bounded drawing protocol.

Additional inventory check: standalone production lockfile contains 98 dependency entries (92 MIT, 4 ISC, 1 BSD-2-Clause, 1 BSD-3-Clause). Root lockfile alone omits license metadata on 88 of its 284 production entries; the existing audit resolves those from installed package metadata. Neither the lock-only counts nor installed metadata verify every distributed license file. No new dependency was installed.

Remaining gates: integrated source completeness and actual deployed anonymous source access; combined-work scope/UI legal notice review; Quaternius acquisition-specific evidence; final notice recheck after implementation imports. Agent 09 can verify final imports when candidate PRs exist. No runtime/shared build patch is made here because Agent 00 owns coordination of those files.

Follow-up validation: five ZIPs parsed, five embedded CC0 notices manually inspected, 11 selected files located/read/hashed, archive hashes independently rechecked, source candidate JSON parsed. Unchanged-runtime test/build results above still apply; they were not rerun solely for these documentation additions.

## Live verification and candidate integration follow-up

Read-only anonymous HTTP checks on 2026-10-29 verified the existing live service, without creating rooms, changing data or deploying:

- **17 live endpoints returned HTTP 200:** party home, source page, source-page script, credits JSON, source JSON, health endpoint, ten upstream notices and chess notice.
- Credits and source report the identical revision `55414cd7d3f8cc903897f5d40f3d0e914aea579b`; credits link to that immutable repository revision.
- **180/180 embedded source files exactly match `git show <reported SHA>:<path>`**, with no missing tracked paths or content mismatches. This proves consistency of the included files, not completeness of the integrated application source.
- A separate anonymous request fetched `server/room-checkpoints.ts` from the pinned public GitHub revision with HTTP 200. Thus at least this omitted integrated file is available through the alternate complete-repository source route. No full clean rebuild from that public revision was performed in this follow-up.

Machine-readable endpoint status/type/size and pinned candidate review heads are in `GX2_LIVE_SOURCE_VERIFICATION.json`. These are HTTP/file checks, not rendered browser or physical-phone acceptance. Source availability is observed for this revision at this time; future releases must repeat the check.

### PR #96: missing license destination repaired for integration

At head `0e967a99989611aaf5e72d83ac02279cd0d63faf`, PR #96 adds `gx2-tv-lobby-reference` to the shipped source manifest. `sources.js` constructs `open-source/gx2-tv-lobby-reference.txt` for this record, but that notice path is absent from the pinned branch (GitHub file request returns 404). Its credits browser test verifies link DOM presence, not that each notice request succeeds. Existing CI success therefore does not establish this new destination works.

This audit PR supplies `examples/party-engine/open-pack/licenses/gx2-tv-lobby-reference.txt`, containing the exact MIT notice from IACBI/matah at `049da257eb690e82d7c47d1f2d502b607adb054a`. No source or art is copied. The existing build generator already publishes all notices in that directory; no runtime/build patch is needed for this fix. Local generation plus real HTTP confirms the new notice returns **200 and exactly matches the retained notice bytes**.

**Integration dependency:** combine this notice with PR #96's manifest change (merge audit #95 before #96, or carry the exact notice into the combined branch). The orphan notice alone does not add a shipped credit on main. Do not release #96's new manifest record without the notice. Agent 00 should also strengthen the existing credits test minimally: fetch every `open-source/${record.id}.txt` and assert success/nonempty content, instead of checking only that its anchor exists. That is the smallest proposed shared-test patch; this audit does not edit another agent's owned browser spec.

### PR #97: no new reuse found in changed-file review

At head `bb19f3184b4dce0399282ce8064825274300d9fb`, changed files contain controller code/styles, browser tests, documentation and screenshots, with no new dependency manifest, third-party asset or shipped-source manifest entry. The phone Options credits URL is preserved. This is a bounded diff review, not a provenance certification of screenshots or unchanged dependencies. Recheck if the PR head changes.

### What remains

The live source/notice availability gate for the **currently deployed revision** is verified. Remaining source-delivery work is to make the integrated download's advertised root build reproducible or describe its standalone scope accurately, and to repeat acceptance after the candidate changes are released. Agent 00 owns that shared build/UI patch coordination. Combined-work license scope and appropriate legal notices still require qualified review; Quaternius stays reference-only. Final third-party import checks remain contingent on actual imports.

No full test/build rerun was needed for this license-text/evidence follow-up. Focused validation: 18 successful external HTTP requests (17 live + 1 pinned GitHub file), 180 exact file comparisons, one generated-notice HTTP/body check, JSON parsing and whitespace checks. The previous 364 passing runtime tests remain baseline evidence only.
