# Bilingual family deck expansion — implementation status

**Branch:** `feature/bilingual-family-decks-20261102` (stacked on the draft content expansion PR #121). **Not merged or deployed.**

## Delivered in this draft

- Original Family Showdown content builder exports **50 complete show configurations** (3 scored boards and 5 lightning questions each), every text and answer available in English and Spanish. The 50 shows are **combinations of 50 authored boards**, not 150 completely independent boards; some topics and answers recur across shows. House points are invented for entertainment and are **not survey results**.
- Original Doodle Dash library of **500 bilingual scene/object drawing prompts** generated from 50 distinct translated objects × 10 authored settings. Prompts are distinct compositions, but the object vocabulary is smaller than 500.
- Original Charades library of **500 bilingual acting prompts in 10 categories**, generated from 100 authored action phrases × 5 performance modifiers. The 10 categories are actions, animals, sports, jobs, emotions, transport, nature, home, music and silly.
- A server-safe selection helper filters by theme/difficulty and chooses stable rotate/fixed/shuffle order. No untrusted client-side scoring keys are required.
- The custom Family Showdown editor (`/party/show.html`) now has a host-facing bilingual language/theme/difficulty/mode selector and loads a validated show into its existing save/host workflow. The picker rotates on every selection *in the current browser session*, **not** after confirmed game completion.
- Node validation tests cover the output counts, IDs, EN/ES score totals and deterministic selection.

## NOT yet integrated

1. Doodle Dash game mode still imports the legacy word bank; it does **not** draw from `bilingual-party-prompts.js`. Before integrating, preserve the current 3-word artist choice, hints, server-authoritative exact-match scoring and reconnect checkpoints. Spanish answers need canonical answer IDs or approved bilingual aliases rather than trusting client claims.
2. Charades runtime still uses its existing two clue banks; it does **not** use the new 10-category library. Before integrating, preserve exactly 16 clues per timed turn, the known privacy boundaries, and avoid exposing the performer's clue on other phone screens.
3. Family Showdown editor-selected shows preserve the existing format but bilingual score equivalence between players who answer in different languages is **not yet implemented**. Current party can host a Spanish or English show, not automatically translate answer judging in mixed-language rooms.
4. Selector controls for Charades and Doodle Dash have not been added to the TV/host lobby. The selector on show.html does not change a running room.
5. PR #131 (presentation locale) and PR #132 (server-side bilingual answer recognition) remain separate draft branches. This draft must be integrated with both before claiming comprehensive bilingual multiplayer.
6. This draft's generated prompts require a human review for idiomatic Spanish, age appropriateness, creativity, and repeated words/themes. Counts are **not** equivalent to 500 independently authored prompts.
7. No live deployment, TV test, physical phone test, or completed automated CI matrix is claimed here.

## Online-source research and license policy

Online references inform architecture and provenance; their question text and imagery are **not copied into this PR**.

- Wikidata structured data: CC0; suitable for future *fact-checked* bilingual trivia statements, but every fact still needs verification. https://www.wikidata.org/wiki/Wikidata:Licensing
- Open Trivia Database: CC BY-SA 4.0; session tokens for no-repeat; do not silently mix its text into original-feud content without license review and attribution. https://opentdb.com/api_config.php
- OpenMoji: CC BY-SA 4.0 icons, attribution and share-alike obligations. Optional future art reference; no assets included. https://github.com/hfg-gmuend/openmoji

## Recommended integration/testing gates

- Run `cd examples/party-engine && npm test`; fix any failures without weakening current tests.
- Run existing end-to-end Chromium, Firefox and WebKit suites.
- Rebase/merge after PR #121, PR #131 and PR #132 integration with code review.
- Implement server-only canonical IDs for multilingual game answers and user-specific localized projections; test mixed English/Spanish devices.
- Verify host picker fully keyboard-operable and usable at phone and TV sizes.
- Verify no-repeat behavior **across completed matches**, not merely successive editor loads. Cover restart/checkpoint and exhausted deck pools.
- Only after those steps: merge in dependency order, deploy through existing safe release flow and run physical-TV + phones test.
