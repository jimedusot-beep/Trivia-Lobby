# Trivia Lobby: English and Spanish belong to the same party

Item 19 makes bilingual support a product-wide identity, covering discovery,
joining, play, learning, creation, recovery and results. The public signature is
**English · Español**; the invitation is **Two languages. One party. / Dos idiomas.
Una fiesta.** Keep Trivia Lobby and Sakura Arcade as proper names. Translate the
invitation, instructions and accessible names around them.

## Product contract

- English and Spanish use equally visible native language choices, without flags.
  Choose once per browser; the host, TV and each phone may choose independently.
  English remains the existing first-visit default; `?lang=en|es` remains an
  explicit page hint. Changing display language must not create a new room.
- Reuse `party-display-language:v1` and the existing locale event. The React
  clubhouse and static party pages share this preference; do not add a second
  competing settings store or broadcast language changes to the room.
- Preserve canonical game IDs, choice indices, event ordering, score rules and
  role-private information. Localized names are display labels, never actions or
  answer keys. Spanish and English answers need server-owned alias rules where
  text scoring applies; translating a label does not add accepted answers.
- Translate first-party interface copy explicitly. Never scan arbitrary DOM text
  or rewrite a player's nickname, quiz questions, imported documents or answers.
  Authored content keeps its exact wording. This work uses authored local copy,
  with no translation API or external translation requests.
- Set document/control/content language accurately, retain keyboard focus and
  readable phone/TV layouts, and allow Spanish text to wrap. Both languages need
  labels, errors, loading, empty states, recovery and results, not only headings.
- Show incomplete coverage honestly. An interface language and the available
  game/question language are different facts. English-only content needs an
  explicit note and appropriate `lang` boundary until its integration is ready.
- Every new first-party feature must include English and Spanish copy or record
  its precise uncovered surface and follow-up under item 19. Do not call a game
  fully bilingual because its catalog card is translated.

## First bounded change: identity and discovery

This local candidate adds the shared language control, bilingual brand signature,
translated public Welcome page, party invitation/discovery text and Spanish
display names/rules/round labels for all 31 catalog entries. Switching language
retains the selected catalog preview and supports searches using either display
language. Canonical catalog entries and engine data remain unchanged.

The public creator, courses, practice, Family Showdown editor, Solo Test, credits
and Open Party Lab receive the shared navigation/language identity. Their forms,
lessons and game content remain partly or wholly English; a Spanish notice makes
that visible. The React sample lesson also retains its English content boundary.
Private library/study/account pages are not localized by this first change.

The existing eight-mode starter-content marker is retained, with a clearer
warning that later rounds can still be English. This is not all-round content
certification. No authored deck is translated, no answer alias is added, and no
gameplay rules or room payloads change in this slice.

## Remaining order for item 19

1. Review and owner-integrate this identity foundation with exact-commit checks.
2. Translate first-party tool forms, study/private-library navigation, account
   flows, status/error messages and recovery/results surfaces. Keep user content
   and licensed upstream text separate; record coverage per surface.
3. Integrate Charades categories/private clues from the preserved source in a
   bounded change, then Doodle artist choices and server-owned bilingual aliases,
   then Family Showdown selection and mixed-language adjudication.
4. Bind content rotation to completed matches and persist its no-repeat state in
   recovery/checkpoints. Merely opening a picker must not consume a new match.
5. Localize Bracket and Timeline display content while preserving contender/event
   IDs, canonical indices and server scoring. Check every round and rematch.
6. Review natural Spanish wording, regional vocabulary, accents, accepted answer
   equivalence, private projections and all lifecycle states. Get bilingual human
   editorial acceptance and actual iPhone/Android/TV acceptance.
7. Review release scope and evidence, then obtain exact-commit deployment approval.

Issue [#133](https://github.com/jimedusot-beep/Trivia-Lobby/issues/133) is the
remaining content tracker. Closed, unmerged PR
[#135](https://github.com/jimedusot-beep/Trivia-Lobby/pull/135), preserved at
`41c4dfd0a28778b0d4193589b8acadef48a2dedd`, is source material, not a ready merge.
Its generated Charades/Doodle combinations and reused Family Showdown boards do
not constitute independent authored surveys or tested runtime integration. Reuse
small reviewed portions from current main alongside already merged #121,
#131, #132 and #134.

## Verification and limits

Use synthetic data. The new tests cover canonical catalog preservation, explicit
copy/accessible attributes, locale subscriptions, cross-page preferences,
independent browser devices, authored-text preservation, narrow layouts and
accessibility. Existing mixed-language tests cover quiz/Majority/Percentage score
parity, Survey/Category all-round behavior, TV presentation and reconnect.

Local browser results use desktop Chromium, Firefox and WebKit with emulated
phone widths. They are not actual iPhone/Android/TV acceptance or production
performance evidence. The standalone UI/proxy fixture exercises the real React
and guest pages without private APIs or a production database; hosted checks must
also exercise the integrated application. Record exact base and candidate bytes,
failures, repairs, retries and skips in the accompanying validation report.

Item 19 stays open until the included end-to-end scope, editorial/device
acceptance and owner integration are complete. This document and local patch do
not authorize publication, merge, deployment or settings changes.
