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

A guest chooses Spanish in Controller options; the entry screen also has a
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

Keep this PR draft until the tests and real mixed-device gameplay are checked.
