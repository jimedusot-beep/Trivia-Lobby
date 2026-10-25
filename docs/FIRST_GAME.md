# Your first Trivia Lobby game — iPhone quick start

**Open the free website:** https://trivia-lobby.onrender.com

Trivia Lobby is already hosted on **Render Free** and connected to your existing **Neon Free** project. You do **not** need to visit Render, Neon, GitHub or Replit to start playing, and you should not create another database or web service.

## Start playing without signing in

The guest-first version opens a public welcome page instead of an email/password prompt.

1. Open the website and choose **Start a Party**.
2. Tap **Create host screen**. Share the six-character party code with friends and family.
3. Each guest opens the same Party page on a phone, enters the code and a nickname, then joins.
4. When 3–8 players have joined, the host can choose **Quiz**, **Prompt Duel**, or **Charades**.
5. Finish the round and choose another game without making an account.

Want to learn instead? Choose **Try a Lesson** from the welcome page. Three sample lessons and basic practice XP save to your current browser only—clearing browser data loses that progress.

**Private study-library access remains optional** and still requires account authentication. Only use that path when you want server-backed personal decks and documents. The guest party uses original sample content, not another user's private library.

## Optional: create a private custom deck

### Make a tiny test quiz

1. Open the website in Safari and tap **New Exam Deck**.
2. On the sign-in screen, tap **Need an account? Register**. Enter your email and a password **at least 12 characters** long. Do not share it.
3. Enter a deck title, for example **Halloween Trivia**, and tap **Create deck and open builder**.
4. In the Exam Builder, leave **Question type** set to **Multiple choice**. Enter a question prompt, two to four answers and choose the correct answer using the radio button.
5. Tap **Save question**. Repeat for two or three questions. The **Question bank** should show the saved count. Questions marked **Live playable** can be used in a multiplayer game.
6. Tap **Back to decks** and find the new quiz under **Your Decks**.

Use throwaway trivia questions for this first test. Do not add real student details, private records or irreplaceable documents before verifying independent backups.

## Host and join

1. Under your quiz, tap **Host**. The host screen should show a six-character room code and a QR code or invitation link.
2. Leave the host screen open. On another phone, another browser or a separate private browsing session, open the invitation link. Players **do not need an account**.
3. Enter a nickname, then tap **Enter Game**. The host screen should show the player's name.
4. Choose **Classic quiz** and tap **Start Game**. Answer questions as the player. Advance rounds from the host screen when available.
5. After finishing, return to **Game reports** from the home screen to review your completed session.

**If you only have one iPhone:** it is easiest to host on a computer and join on your phone. You can also use a second browser or private tab, but switching away from the host may interrupt a live socket on some devices.

## How to tell if the server is awake

- [Application health](https://trivia-lobby.onrender.com/health/live) should display `{"status":"ok"}`.
- [Database readiness](https://trivia-lobby.onrender.com/health/ready) should display `{"status":"ready"}`.
- [Your Render Free service](https://dashboard.render.com/web/srv-dbecn2nb9u1s7398u8j0) shows deploy status and logs if the website fails to start.

Render Free sleeps when idle and can restart active games. Existing saved decks, assignments and finished reports persist in Neon, but a live room held in server memory does **not** survive a restart.

## What is verified vs. not yet verified

The public smoke test checks the website's real HTML, database readiness, private-route access denial and WebSocket access safeguards. CI separately tests full quiz flows against disposable test databases and multiple browsers.

A complete real-account, two-device game on the **public production site** still needs to be played manually. This guide is the next acceptance checklist; **do not** claim production classroom readiness from automated smoke tests alone.
