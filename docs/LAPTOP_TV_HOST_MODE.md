# One-click TV hosting on a Windows laptop

Trivia Lobby already has a shared-screen host, QR invitations, player roster, and Game Night Championship. This focused enhancement adds **Enter TV full screen** to the existing host game screen. It uses the browser's built-in Fullscreen API, not a new streaming service or second host.

## Online party (simplest)

1. On your laptop open **https://trivia-lobby.onrender.com/party/**, or follow the guest-party link exposed by the deployed site. Verify the URL in the actual deployment.
2. Create a host screen or host a game from the library. The host is a separate display and does **not** count as one of the players.
3. Display the QR code and room code so guests can join on their phones.
4. Select **Enter TV full screen**. The browser must allow fullscreen for that click. The button changes to **Exit TV full screen**.
5. Press **Escape** (or use Exit TV full screen) to return to the regular browser.
6. If the Fullscreen API is unsupported/blocked, the host sees an explanation. On Windows, **F11** can make the browser window full-screen instead.
7. Connect the laptop to a television using HDMI if desired and choose duplicate or extend display in Windows settings.

This does not start a new room, change gameplay/score handling, or keep the server awake. **Deploying is a separate, owner-approved action**. A PR alone cannot update Render.

## LAN party without a cloud server

This is the existing standalone guest server, not the full account/private library service:

```powershell
git clone https://github.com/jimedusot-beep/Trivia-Lobby.git
cd Trivia-Lobby\examples\party-engine
npm ci
$env:HOST = "0.0.0.0"
$env:PORT = "3001"
npm start
```

If you have already cloned the repository, update it with `git pull --ff-only` in its root **when not hosting a party**, and run `npm ci` in `examples/party-engine`. Do not overwrite your own uncommitted changes.

Find the Windows laptop's private Wi-Fi IPv4 address with `ipconfig`. On the **laptop**, open `http://YOUR-LAN-IP:3001` rather than localhost before creating the QR invitation. Replace YOUR-LAN-IP with the actual address; do not guess. Keep all phones on the same trusted LAN, and allow private-network access through Windows Firewall if prompted. Do not port-forward the party server or expose the LAN instance to the public internet.

Local guest rooms exist only in memory and are lost when that standalone server stops. The Render/Neon deployment has different persistence infrastructure. Some motion/hardware APIs require HTTPS and may not work on local HTTP origins.

## Verification scope and limitations

Automated Playwright checks cover host-only control visibility, a QR invitation remaining available, the button's active/inactive state and a browser-generated fullscreenchange notification; a second test covers an unsupported Fullscreen API. Fullscreen itself is **mocked** in this functional test to avoid false positives about physical hardware; physical Windows F11/HDMI, iPhone/Android, TV overscan, 10–20-player Wi-Fi performance and Chrome/Edge actual fullscreen activation require manual acceptance.

There is no game engine, WebSocket, database, account, license, dependency, or third-party asset change. If the normal browser layout or full screen is inconvenient, exiting full screen restores the original host interface; there is no persistent kiosk lock.
