# Bilingual Trivia Lobby: English / Spanish, phase 1

Display language is optional and selected separately on each phone or TV.
One shared room can contain English and Spanish players without changing
WebSocket actions, scores, answer indexes, player IDs, private data or reconnect tokens.

Included in the first release candidate:
- Entry navigation and essential host/controller labels (English fallback remains).
- Game shelf descriptions and names in the first five supported games.
- Sample Quiz: five questions, choices, explanations, fixed answer indexes.
- Charades: all action and animal clues, private-performer projection and history.
- Majority Rules: five prompts and indexed voting choices.
- Who's Most Likely?: five prompts; player IDs and nicknames stay intact.
- Closest Wins: five prompts and display units; numeric scoring unchanged.

Phase 2 candidate (separate PR #134, built on merged Phase 1):
- Guess the Percentage: five fixed original poll prompts and the numeric-guess stage;
  Spanish Sí/No still sends the same 1/0, guesses remain numbers from 0–100,
  and server-side score calculations stay unchanged.

A guest chooses Spanish in Controller options; the TV host also has an
in-game language selector visible inside browser fullscreen. The entry screen has a
Language / Idioma selector. The selection is saved only in that browser.
English remains the default. This uses no translation service and no new dependency.

Important limitations:
- Custom/imported quiz text always remains in its authored language.
- The creator, study, Solo Test and Open Party Lab pages remain English.
- Other game content can remain English even when the navigation is Spanish.
- Free-text answer validation for Survey Showdown, Category Clash, Forbidden
  Word Frenzy, Family Showdown and other word-based packs is not yet bilingual.
  Translate those only alongside server-side Spanish synonym sets, normalization
  and tested score equivalence.
- Never auto-translate nicknames, player captions, or user-authored questions.
- Some dynamic status and error messages remain English.

Verification before merging or deploying:
1. Run npm test and npm run test:browser in examples/party-engine.
2. Create an English host and connect one English and one Spanish phone.
3. Complete the five sample questions; compare answer index and scoring.
4. Play full Charades turns and confirm non-performers cannot see private clues.
5. Play Majority, Likely and Closest with mixed-language guests and reconnect.
6. Check small-phone controls and Chromium, Firefox, WebKit TV/guest navigation.

Release policy: PR #134 stays draft until all required main-branch checks and its
focused Chromium, Firefox, WebKit, and Node validations pass on the exact head.
A passing simulator does not establish a successful real iPhone/iPad/TV party.

Eight-player family pilot (after an explicitly approved deployment):
1. Use one iPad or laptop as the TV host, mirroring to the television. Keep a
   separate device for each of the eight players; the mirrored host is not an
   extra independent phone controller.
2. Use the same Wi-Fi. Have four phones select English and four select Spanish,
   or another actual mix. Verify each selector and readable QR/join instructions.
3. Complete Quiz, Charades, Majority, Likely, Closest, and Percentage with the
   expected player count. Check numeric scores, reveals, and invitation privacy.
4. Toggle the TV language during an active round. Confirm no guest preferences
   change; reconnect one phone without duplicate scoring or lost room ownership.
5. Note device/browser model, latency, disconnects, TV text legibility, heat and
   battery behavior, and any failures. Fallback to English or a fully verified
   game rather than reusing a partially tested mode.

No production deployment or offsite backup configuration is authorized by
this checklist. The deployment requires a separate explicit go/no-go.
