# Phase 1 reference audit (2026-10-21)

The repositories below were located in public GitHub metadata and their actual server/source paths or directories were inspected. SHA values are the checked branch HEAD prefixes. **These are source references, not dependencies, runtime-tested clones, proven reverse engineering, or a right to copy code.** No third-party source code was copied to Trivia Lobby.

| Repository | Classification based on available evidence | Source code / directory identified | HEAD checked | GitHub license metadata |
|---|---|---|---|---|
| [soleilvermeil/open-kahoot](https://github.com/soleilvermeil/open-kahoot) | Independent Kahoot-style implementation | `server.ts`, `src/lib/game/` | `929c810b2c12` | AGPL-3.0 |
| [ethanbrimhall/kahoot-clone-nodejs](https://github.com/ethanbrimhall/kahoot-clone-nodejs) | Independent Kahoot-style implementation | `server/server.js` | `a2b4aba7c90f` | None detected |
| [mawoka-myblock/ClassQuiz](https://github.com/mawoka-myblock/ClassQuiz) | Independent classroom quiz application | `classquiz/socket_server/`, `classquiz/tests/` | `c4ff3e5ae2f5` | MPL-2.0 |
| [stevenjr-yt/Quiz-Platform](https://github.com/stevenjr-yt/Quiz-Platform) | Independent quiz platform | `backend/index.js` | `5ca6d5e5e396` | NOASSERTION |
| [s-tn/Gimkit-Clone](https://github.com/s-tn/Gimkit-Clone) | Independent Gimkit-style implementation | `index.js`, `games/` | `f54cfe33b203` | None detected; archived |
| [Lawndlwd/quizz](https://github.com/Lawndlwd/quizz) | Independent real-time quiz application | `server/src/socket/`, `server/src/questionScoring.ts` | `bf12cc14e231` | MIT |
| [arvindfroi/quizparty](https://github.com/arvindfroi/quizparty) | Independent browser party quiz | `js/host.js`, `js/player.js`; host-side PeerJS | `e21b49a9601c` | MIT |
| [virgilvox/doot-games](https://github.com/virgilvox/doot-games) | Independent multiplayer game project | `apps/web/`, `packages/` | `0f78d6d11e7a` | MIT |
| [yohurokano/openquiz](https://github.com/yohurokano/openquiz) | Independent quiz implementation | `server/src/protocol.ts`, `server/src/state.ts` | `9c787451b92b` | None detected |
| [kylejckson/NanoQuiz](https://github.com/kylejckson/NanoQuiz) | Independent lightweight quiz server | `server.js` | `2c29a0b096ec` | MIT |

## Verification status and reuse policy

- GitHub repositories, checked revisions, root/source paths and GitHub-displayed license metadata were verified on October 21, 2026.
- **Upstream runtime behavior was not executed**. A located source file does not prove that multiplayer, timing or reconnection works. No such third-party tests are claimed passed.
- The label *clone* is interpreted as independent recreation of quiz functionality. Do not assert decompilation, reverse engineering of a closed protocol, leaked code, or AI reconstruction without specific evidence.
- Repository license metadata may be incomplete or incorrect. Examine the exact license texts and individual file provenance before reuse. Missing license and NOASSERTION imply reference-only absent a separate grant. AGPL-3.0 and MPL-2.0 may impose additional obligations.
- Trivia Lobby implementation in this PR is independently authored from general design principles. No external artwork, names, proprietary APIs, client/server protocols, private keys, or code are bundled.
- If future PRs copy lawful permissively licensed code, record source filename, full commit SHA, changed lines, test evidence, author attribution and license notices.
