# QR invitation landing

Problem: a guest who follows a party QR link sees the full hosting page and game catalog before finding the nickname form on a phone.

Deliver a compact invitation view at `?code=...`: show the room code, a nickname field and Join party above the fold. Keep hosting, course and game-selection links out of this entry view, with a clear path back to the game menu. Let guests change the room code. Invalid links and server join errors must remain readable without clearing the typed nickname.

Existing same-room sessions reconnect normally. A different invitation must never silently return a player to the wrong room: offer return to the saved party, or let them explicitly join the invited party. Retain the previous party access until joining the new one succeeds, including when the new invitation is invalid or full. Keep reconnect credentials out of invitation URLs and public UI.

Acceptance: each of the 14 invitation flows shows nickname and Join party on a 390px phone; keyboard focus starts on the needed field; invalid/missing rooms can be corrected; matching sessions reconnect; different-room joining and return preserve the right identity; hosting/custom quizzes and ordinary manual code entry still work. Validate the main application QR pixels and the focused landing in Chromium, Firefox and WebKit, including accessibility and a 320px viewport.

No accounts, dependencies, server protocol, scoring, room-cap, database, billing or Render configuration changes. Camera hardware and a physical-phone group pilot remain outside the automated evidence.
