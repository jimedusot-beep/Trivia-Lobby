# Game-mode browser acceptance

Every supported game mode runs through the real UI and WebSocket server in the Chromium, Firefox and WebKit CI matrix. Each scenario uses an authenticated host and separate guest browser contexts with 375-pixel viewports; decks are cleaned up after each test. No WebSocket, game-state or scoring mocks are used.

| Mode | Browser scenario and observable result |
|---|---|
| Classic | The existing multiplayer scenario hosts two rounds, reconnects both host and player, answers, reveals scores and finishes. |
| Teams | Three players join alternating teams 1/2/1. Correct/missed answers produce aggregate team totals of 200/0, then 310/100. All players receive the final leaderboard. |
| Buzzer | Answers start disabled. One player owns the buzzer exclusively; after five seconds it releases to another player. A wrong answer also releases ownership; a correct answer reveals the round. |
| Wager | A new player cannot stake unearned points. A 50-point winning wager awards 160 in round two; a subsequent 100-point loss leaves 160 total. Reconnect restores the earned-point limit. |
| Workshop | An earned Focus purchase survives reload and adds 50 once. A Guard purchase preserves the two-answer streak across one miss; a later miss resets it. Six rounds finish at 480 points, with costs and disabled purchases reflected in the UI. |
| Party | Consecutive correct answers award 100, 110 and 240. The third-round multiplier remains after host reload; final score is 450. |

The added scenarios request reduced motion. A page-start observer records even a short-lived animation canvas, so assertions cannot pass merely because confetti finished before inspection. Live-game confetti now uses the library's `disableForReducedMotion` option. Final phone layouts are also checked for horizontal overflow.

The five new mode scenarios pass locally in Chromium with retries disabled, alongside type checking, the production build and HTTP/database/WebSocket smoke. CI enforces them in all three engines before merge. Together with the seven prior functional/accessibility scenarios and two production-stylesheet checks, the suite now contains 14 scenarios per browser (42 cases). Native PostgreSQL, repeated migrations, encrypted recovery, 57 unit/socket tests and the full dependency audit remain separate required checks.

These are representative end-to-end acceptance paths rather than exhaustive coverage of every input, disconnect timing or player count. Schema, role, stale credentials, timer deadlines and duplicate-answer defenses also have socket/unit coverage. Rooms remain process-local and end when the server restarts.
