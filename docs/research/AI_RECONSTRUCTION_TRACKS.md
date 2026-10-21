# AI reconstruction research: five new tracks (2026-10-21)

This supplement extends [the original catalog](../LEARNING_GAME_RESEARCH.md), [the feature roadmap](../RESEARCH_TO_FEATURE_ROADMAP.md), and the [existing integration blueprint](./INTEGRATION_BLUEPRINT.md). It **does not duplicate** the previous six browser-cloning references or repeat their 28 educational project entries.

The machine-checkable companion file is [ai-reconstruction-candidates.json](./ai-reconstruction-candidates.json). Evidence labels describe *what is claimed or described*, not independently reproduced results.

| Evidence label | Interpretation |
|---|---|
| `reconstruction-tool` | Described tool for reconstruction/automation; local verification still required |
| `tool-lead-unverified` | Candidate tool; verify primary source, functionality and license |
| `community-catalog` | Secondary collection; never treat as original evidence |
| `case-study-claim` | Developer/community claims a reconstruction; inspect proof and scope |

## Selected tracks and safe implementation gates

### 1. REA + Reconstruction Companion
Candidates: [REA](https://github.com/MaurizioCasciano/Reverse-Engineer-Anything), [Reconstruction Companion](https://github.com/ShadowSwaps/REA-Reconstruction-Companion).
- **Deliverable:** locally authored, evidence-linked specification of Trivia Lobby's *own* room join, host start, answer, score and finish states.
- **Proof:** each requirement records evidence ID, origin URL or local test fixture, observed action, expected result, access permission, and uncertainty.
- **Gate:** no automatic external access, reverse-engineering packages or opaque binaries installed; do not inspect unauthorized or paywalled content.

### 2. Browser Use + Playwright
Candidates: [browser-use](https://github.com/browser-use/browser-use), [open-browser-use](https://github.com/open-browser-use/open-browser-use). Playwright is a testing framework; do not conflate it with Browser Use.
- **Deliverable:** deterministic browser E2E tests against a locally started Trivia Lobby instance, simulating separate host and player contexts.
- **Proof:** player joins, host starts round, one answer counted once, countdown and result render; assert accessible labels and reconnection.
- **Gate:** local disposable data and test-only credentials; server+database fixture must be available first.

### 3. Screenshot-to-Code + Component Forge
Candidates: [screenshot-to-code](https://github.com/abi/screenshot-to-code), [Component Forge](https://github.com/maria-shimkovska/ui-screenshot-to-code-agent-agentspan).
- **Deliverable:** original React story/prototype of a responsive answer card and matching/image question state.
- **Proof:** no imported third-party artwork, snapshot/accessibility review, keyboard/touch testing, TypeScript build passing.
- **Gate:** no generator added to production dependencies without isolated vetting.

### 4. HyperAgent + Bug0 AI
Candidates: [HyperAgent](https://github.com/hyperbrowserai/HyperAgent), [Bug0 AI](https://github.com/bug0inc/qa-agent).
- **Deliverable:** repeatable test flow recording for Trivia Lobby's own user journeys; compare with ordinary Playwright baseline.
- **Proof:** twice-replayed run is stable and screenshots are scrubbed of secrets; failing assertion produces reproducible trace.
- **Gate:** examine dependencies, retention, telemetry, secrets, licensing before trial.

### 5. AI-rebuilt games and technical case studies
See companion manifest for the case catalog, including [DX-Ball](https://github.com/N0zoM1z0/dx-ball), [Ski or Die](https://github.com/tuunanet/rea-ski-or-die-reconstruction), and the [community index](https://github.com/AIshihzong/awesome-reverse-engineer-anything).
- **Deliverable:** a case-study template with author, primary evidence URL, AI/REA method, original artifact rights, scope of reconstruction, commands/tests, measured parity, unresolved gaps.
- **Proof:** distinguish an experimentally compared function from a fully recreated game. Do not invent pass counts or claim developer tooling without traceable proof.

## Actionable tasks (ordered)
1. **P0:** Add and test the research manifest's uniqueness, known track keys, evidence labels, and source URLs. No runtime dependencies.
2. **P0:** Inventory current host/player WebSocket states and link observations to test scenarios; coordinate with [PR #5](https://github.com/jimedusot-beep/Trivia-Lobby/pull/5) rather than rebuilding the question model.
3. **P1:** Add local Playwright E2E configuration with seeded/test database and isolated WebSocket server; prove joining, round start and final score.
4. **P1:** Write evidence-linked requirement documents for those interactions; only automate capture from our own local instance.
5. **P2:** Develop original responsive answer-card prototypes with accessibility tests; vet generator output before merging.
6. **P2:** Trial a replay agent only if it beats ordinary Playwright on reproducibility, cost, and privacy.
7. **P3:** Review primary build logs for case-study claims; classify independently verified behavior separately from author reports.

## Recording template
```yaml
id: TL-ROOM-001
system: Trivia Lobby local development
permission: owned-application
evidence_source: tests/e2e/host-player.spec.ts
observed_action: player joins a host-created room
expected_result: host sees one participant
verification_method: two browser contexts, deterministic seed
result: not-yet-tested
limits: requires local test database and websocket server
```

## Scope and safety
No third-party source files, logos, captured cookies, login tokens, or proprietary game assets were imported. These items are research leads; every dependency requires license, maintenance, security and privacy review before installation.
