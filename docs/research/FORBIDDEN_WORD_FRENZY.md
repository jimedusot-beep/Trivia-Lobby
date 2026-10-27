# Forbidden Word Frenzy — native guest game (3–20 players)

**Source of inspiration:** [Open Party Lab Buzzwort](https://github.com/Hartwich/buzzwort), an alpha forbidden-word speaking game. This Trivia Lobby implementation is **original**; it does not include Buzzwort source, prompts, images, sounds or other assets. The upstream code declares Apache-2.0 and warns that word-list rights and assets need review. No upstream code is redistributed here.

## How a family plays

- The **existing Trivia Lobby QR room** joins 3–20 family phones. The laptop/TV displays the current clue-giver, referee, number of cards and countdown without spoiling the secret.
- Each of the players gets one **45-second turn** as clue-giver. The next player in the original room roster is the referee. All other players guess aloud.
- Only the two role phones receive the same private secret card, showing the target phrase and four words that cannot be said.
- The referee marks **Correct (+20 to giver)**, **Forbidden (-10 to giver, floor 0)** or **Pass (+0)**, up to five original cards per speaking turn. A 350ms minimum gap avoids accidental double submission. The server validates the authenticated referee, action schema, phase, timer and score.
- At timeout/five cards, the host sees a public round summary. Host chooses Next; roles rotate. Normal Trivia Lobby match scores and signed reconnect credentials are reused. With PR #74, a completed game can contribute to cumulative championship standings.
- Does **not** capture voices, record speech, use AI listening, stream a shared screen or require a second backend.

## Privacy and role separation

`projectForbidden()` exposes `card.word` and `card.forbidden` **only** to the active clue-giver and referee while playing. It never sends hidden words to the host/TV or ordinary guessing phones. Only after the round reveal does it show completed history to all guests. Scoring is server-side, never from a phone-supplied point amount.

## Limitations

This is a family-trust game. The referee listens and judges whether a word was spoken; there is no automated audio analysis or semantic speech matching. Room capacity and UI support are not proof of a measured 20-physical-device test. The 16 custom prompts rotate as needed and are intentionally a small starter pack for validation. Do not advertise it as a direct port of Buzzwort or the upstream game's exact rules.

## Verification gates

`cd examples/party-engine && npm test` covers role isolation, referee authorization, private projection, completed/timed turns and scoring. `npm run test:browser` covers QR-joined host + 3 phones, private card isolation, referee scoring, 375px mobile layout and reconnect. Run complete multi-browser CI before merging, then repeat with real iOS/Android devices and target Wi-Fi.

The upstream game catalog retains all 21 research entries, and adds a clearly labeled **native alternative** link for Buzzwort. No upstream assets are copied.
