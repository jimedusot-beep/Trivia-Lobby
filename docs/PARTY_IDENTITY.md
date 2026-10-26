# Trivia Lobby: game-night clubhouse identity

## Outcome and design decision

Give the homepage, guest party, quiz creator, practice and learning pages one
recognizable, colorful personality. Apply the same palette, typography and tactile
controls to the React study tools. The functional references are the cheerful
color and board-game energy requested by the user; all artwork, layout and mascot
geometry here are original. No Nintendo or Trivia Crack logos, characters, music,
assets or application code are used.

The existing pages, shared React controls, shipped fonts and accessibility/browser
tests provide enough evidence for this visual change. No additional competitor
research or dependency is needed.

## Visual system

- Warm cream paper, deep ink outlines, vivid violet, coral, sky, mint and gold.
- Self-hosted Fredoka headings and Nunito body text, using the existing licensed
  font packages. Guest assets include their OFL notices.
- Original **Lobby Spark**: a friendly yellow four-point star with a smile. A
  tabletop illustration, game-piece motifs, sticker badges and offset shadows
  make the identity specific to Trivia Lobby.
- Clear primary actions, colorful answer tiles, readable progress and expressive
  completion feedback. Motion is brief, triggered by interaction and optional
  through the operating system's reduced-motion preference. No automatic sound.
- Shared source tokens and assets across the React app and standalone guest pages.

## Acceptance

- Existing guest entry, authoring/import, solo practice, learning resume/backup,
  host/join/reconnect and private-library routes keep their behavior and labels.
- No new sign-in requirement, database changes or multiplayer protocol fields.
- All controls retain keyboard labels, visible focus and readable contrast. Choice
  labels, selected/correct states and scores remain understandable without color.
- Phone and desktop layouts have no horizontal scrolling at supported widths;
  long quiz titles and answers wrap. Decorative art cannot obscure controls.
- Reduced motion removes entrance/bounce/confetti movement. Completion effects
  stop and remove their decorative nodes; no continuous background animation.
- Fonts and vector artwork load from the application origin, including the
  standalone server. The existing CSP stays intact; no external font requests.
- Verify typecheck, existing unit tests, production build, affected browser flows,
  automated accessibility and captured phone/desktop screenshots before merging.

This is a presentation change. Points, learning rewards, correctness, deadlines,
credentials and private-data authorization remain the existing implementation.
Deployment and verification of the public website remain separate from merging.
