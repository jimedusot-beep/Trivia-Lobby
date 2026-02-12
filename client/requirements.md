## Packages
framer-motion | Essential for the playful, game-like animations (cards flipping, transitions)
papaparse | For parsing CSV imports of flashcard decks
@types/papaparse | Type definitions for papaparse
canvas-confetti | For celebration effects on win/correct answers
@types/canvas-confetti | Type definitions for canvas-confetti

## Notes
WebSocket connects to /ws path.
Protocol needs to handle wss/ws based on window.location.protocol.
Player ID should be stored in localStorage for reconnection reliability.
Tailwind config should use CSS variables for dynamic themes.
