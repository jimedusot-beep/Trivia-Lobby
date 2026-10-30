# Handshake × OpenAI multiplayer game challenge — submission handoff

Prepared October 30, 2026, for **Trivia Lobby**, the existing project. This document is a submission aid, **not** a confirmation of contest eligibility, production deployment, real-device acceptance, or actual submission.

## Official requirements and deadline

- Mission: https://joinhandshake.com/learn/create-a-multiplayer-game-8d7d59b5/
- Contest rules: https://go.joinhandshake.com/rs/390-ZTF-353/images/%5BAI_Skills_Studio_Challenge%5D_Contest_Official_Rules.pdf?version=0
- Official rules give **October 30, 2026, 11:59 PM Pacific** as the deadline (October 31, **2:59 AM Eastern**). The short mission page says October 31. Use the *earlier, precise* rules deadline.
- Eligible adults must be residents of a listed country and use an active Handshake account. Enter through the actual Handshake **OpenAI: Create a Multiplayer Game** mission, not merely by sharing a GitHub link.
- Submission requires **project title, cover image, description, and public URL**. The official mission calls for using ChatGPT **Work mode** to plan/build/test and publish a live reusable multiplayer browser game with nickname/room-code joining and no required account/install.
- The official rules are unclear on whether a game started *before* the mission qualifies. Do not represent a prior GitHub commit as newly built in the mission. Complete the mission in good faith and document real work performed; ask Handshake if unclear.
- Human-only submission: do **not** script or mass-submit contest entries. Entrants should read the publicity license and other terms before entering.

## Suggested submission (review against the *deployed* version first)

**Title:** Trivia Lobby — Play Together, Learn Together

**Public game URL:** https://trivia-lobby.onrender.com/party/

**Description:**

> Trivia Lobby is a browser-based multiplayer party game and quiz platform designed for friends, families, and classrooms. A host opens a shared screen, other players join by room code or QR invitation using nicknames, and everyone plays without installing an app or creating an account. The platform combines original trivia rounds with social, team, and arcade-style party games, along with a browser-local custom quiz creator. Built with AI-assisted software development using TypeScript, React, Express, and WebSockets, Trivia Lobby explores how accessible group games can support friendly competition and learning.

**Accuracy note:** The party screen and guest engine are built with HTML/CSS/JavaScript and WebSockets within the broader TypeScript/React/Express project. Only advertise modes actually verified on the deployed build. A Render Free restart interrupts active rooms; this is a preview, not guaranteed uptime.

**Cover image candidate:** An original in-repository visual from `docs/evidence/gx2-tv/lobby.png` or `docs/evidence/gx2-tv/after.png`. **These are historical local browser screenshots, not evidence of the currently deployed site.** Prefer a *fresh screenshot of the live /party/ page* captured on a desktop browser before upload. Avoid private data, external brand artwork, and misleading edited screenshots.

## Judge's 90-second path

1. On a computer, open https://trivia-lobby.onrender.com/party/ and choose **Create host screen**. Render Free may have been asleep; wake it before judging.
2. Join as **at least two guest players**, using separate phones or isolated browser sessions, with the six-character party code and nicknames. The host screen is **not** automatically a player. QR invitation is an alternative to manually entering the code.
3. Choose a mode that permits your actual guest count. Some modes need more than two guests (the first-game guide describes **3–8 guests** for its sample Quiz flow). Start one short game and observe answers/points update on the host screen.
4. Finish the match and return to the same party to start another mode. Try a different device size; do not assume the live site contains all recently merged GitHub features.

## Verification gates and evidence

### GitHub source / CI (machine-checkable)

- [ ] Main branch's **CI** workflow has succeeded on the intended submission SHA.
- [ ] **Integrated platform acceptance** succeeded on that same SHA.
- [ ] **Guest party engine** Chromium, Firefox, and WebKit jobs succeeded on that SHA (record skipped tests separately).
- [ ] Review `docs/OPEN_SOURCE_ATTRIBUTION.md` and `docs/GX2_PROVENANCE_AUDIT.md` for source/license limitations.
- [ ] **Contest demo release gate** passes for the exact public deployed SHA. Run the GitHub Actions workflow manually after any Render deployment; by default it expects the workflow's source commit. It checks HTTPS health, database readiness, guest entry, static assets and the public build manifest. It **does not** create users/rooms or certify multiplayer gameplay.
- [ ] Existing public smoke workflow checks HTTP/DB, private API safeguards and authenticated WebSocket boundary separately.

### Live, physical and submission checks (human-required)

- [ ] Open public URL in a clean desktop/private browser; no account or installation is required to **host/join the guest party**.
- [ ] Use a host display plus **at least two guest player sessions** (ideally two physical phones), meet that mode's minimum, play a complete multiplayer round, verify synchronization, finish and replay.
- [ ] Test actual QR scanning and basic phone readability; do not claim 20-device testing without actual devices.
- [ ] Verify the deployed source SHA at `/party/open-source/credits.json` matches the reviewed GitHub commit; if not, deploy the reviewed version using the **existing Render service** with auto-deploy disabled. Do not create new services or Neon databases.
- [ ] Take one true-to-life screenshot of the working public guest interface for the cover image.
- [ ] Complete Handshake's Work-mode mission, submit the title/image/description/URL **in Handshake**, and confirm an accepted submission before the deadline.

## How to run the contest public release gate

In **GitHub → Actions → Contest demo release gate → Run workflow**, select `main`. For `expected_sha`, leave blank to check that the public site was built from the same commit as the workflow, or supply an exact 40-character known-good SHA you intentionally deployed. The job fails loudly if the public website is stale. The verifier is read-only and requires no secrets.

From a machine with Node 22+:

```sh
node --test script/contest-readiness.test.mjs
SMOKE_URL=https://trivia-lobby.onrender.com EXPECTED_DEPLOYED_SHA=<40-character-sha> node script/contest-readiness.mjs
```

Never paste credentials into GitHub or run database migrations simply to enter this contest. No code or GitHub workflow can enter Handshake on the user's behalf or independently prove the contest sponsor accepts a previously started project.

## Deployment boundary

The repository defaults to manual Render deploys. **Merging a GitHub PR is not a production release.** Use the existing `https://dashboard.render.com/web/srv-dbecn2nb9u1s7398u8j0` service after verifying the chosen code; validate the public SHA and repeat the two-device game after deploying. If new main has unrelated work still under review, do not blindly merge it just for the contest.
