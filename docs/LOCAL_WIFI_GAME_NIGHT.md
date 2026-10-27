# Host Trivia Lobby on your own laptop or Raspberry Pi (local Wi-Fi)

**Purpose:** 2–20 phones join by the existing Trivia Lobby QR code, using one Windows laptop or Raspberry Pi as the host. This is the standalone **guest games** server—not the full account/private-library application. It needs **no Render, Neon, third-party streaming, game controller hardware or subscription** once installed. All participants must reach the same local server. This guide is based on the actual `examples/party-engine/server.js`, `package.json` and `public/room-invite.js`, and is not a claim of physical-device verification.

## Before the party

You need a functioning Windows laptop **or** a Raspberry Pi with a 64-bit Linux OS, Node.js **22 or newer**, Git, and a Wi-Fi or Ethernet LAN connecting the host and phones. An initial internet connection is needed to download packages and clone the repository. The Pi build, physical 20-client performance and Wi-Fi coverage have **not** yet been benchmarked.

Install or verify tools on the host:

```sh
node --version
npm --version
git --version
```

**First install** (same shell on Windows PowerShell or Linux; the commands below are cross-platform):

```sh
git clone --branch main https://github.com/jimedusot-beep/Trivia-Lobby.git
cd Trivia-Lobby/examples/party-engine
npm ci
npm test
```

This package runs the standalone guest server and ships its own bundled interface. There is no reason to run `npm run build` for the full account application, enter Neon credentials, or deploy to Render just to host a family QR game. Initial startup generates local source/credit notices.

## Windows laptop — host

In the same PowerShell window as the installation:

```powershell
$env:HOST = "0.0.0.0"
$env:PORT = "3001"
npm start
```

Find the **Wi-Fi adapter's IPv4 address** with `ipconfig`. If it says `192.168.1.27`, open `http://192.168.1.27:3001` in **the host laptop's browser**. This is an example, **not** your actual address. Do **not** open `localhost` when creating the QR invitation; a QR code containing `localhost` points phones back to themselves.

If Windows Firewall asks whether Node.js can accept connections, allow it on the **trusted private network only**. Do not make the game host publicly accessible on unknown Wi-Fi or port-forward 3001 to the internet.

## Raspberry Pi — host

Use **64-bit Raspberry Pi OS or another 64-bit Linux distribution** with Node.js 22+. After cloning/installing as above:

```sh
HOST=0.0.0.0 PORT=3001 npm start
```

Find the Pi's local IPv4 address using `hostname -I` (choose the actual address on the Wi-Fi/Ethernet network; multiple addresses may be shown). On a laptop or tablet, open `http://PI-LAN-IP:3001`, replacing the placeholder with the real value.

A Pi may run the **server without a monitor**: display the host URL/QR on a different browser and have everyone scan that one. The Pi must stay powered on and on the LAN. Check the device's CPU temperature, memory pressure and latency before trusting it for 20 people; source compatibility alone is not proof of capacity. No extra video streaming or display forwarding is required.

## Join the family

1. Open the **LAN URL** on the host laptop/browser and choose a game or **Create host screen**.
2. Host chooses **Create** and reads the six-character room code. The host screen does **not** count toward the 20 player limit.
3. Have 2–20 players scan the on-screen QR code on iPhone/Android, join the *same local Wi-Fi*, and enter unique nicknames. The phone does **not** need an app install.
4. Start the game. Scores and Game Night Championship standings remain on the same server room when returning to that room's lobby and choosing another game. A newly created room starts a new championship.

**Important:** The host must open the LAN URL *before generating the invite*, because the join URL/QR is derived from the host page's browser origin. If that page says `localhost:3001`, phones will not be able to reach it.

## Troubleshooting

| Symptom | Likely issue and safe check |
|---|---|
| Phone cannot scan/join | Use the direct join link or six-character room code. Verify the host URL contains the actual LAN IPv4, not localhost. |
| Browser says site cannot be reached | Same Wi-Fi? Is Node still running? Check that `npm start` has not exited, IPv4 is correct and host firewall allows **private LAN** port 3001. |
| Phone connects but room cannot be joined | Some guest/hotel Wi-Fi blocks device-to-device traffic (client isolation). Use a trusted home router/LAN instead. |
| Room disappears after a while | Guest rooms and championship scores live **in RAM**. Restarting Node, rebooting the Pi/laptop or losing server power clears them. |
| Phones freeze or have input delay | Check router signal and congestion, avoid host sleep/thermal throttling, try 2 phones first, then 10, then 20. Record real performance; do not assume a Pi model can reliably handle every real-time mode. |
| iPhone page shows “Not Secure” | Local plain HTTP can show this indicator. Do not send passwords or private information. The standalone guest server uses nickname-only play and does not handle private accounts. Browser hardware features requiring HTTPS may not work. |
| Live Render site has different games | The local checkout runs the version of the repository you cloned. The online version deploys separately; GitHub merging doesn't automatically update Render. |

## End safely and update later

To stop the standalone host, press `Ctrl+C` in its terminal. This ends all active rooms and in-memory championships.

To update the host to the most recently merged GitHub games (only when you are **not** running a party), go to your local `Trivia-Lobby` checkout root, run `git pull --ff-only`, then `cd examples/party-engine`, `npm ci`, `npm test`, and restart the host. Do not overwrite local modifications without backing them up first.

## Acceptance checklist before a full family game night

- [ ] Confirm **2** physical phones (at least one iOS Safari and one Android Chrome, if available) can join by QR and finish a match.
- [ ] Test one host reload and one guest disconnect/reconnect.
- [ ] Try **10** then **20** active phones in the actual room and Wi-Fi environment, recording CPU/RAM, latency, dropouts and socket backpressure.
- [ ] Complete a Tap Dash or Grand Prix match; return to the same room and start a second game; verify cumulative championship points.
- [ ] Power off/reboot in a **test** session to confirm users understand in-memory rooms don't survive restarts.
- [ ] Verify license/credit links work in the offline local copy. Do not copy Nintendo/Sega/Crash game graphics or proprietary assets into original modes.

**Source:** [Standalone server](../examples/party-engine/server.js), [guest README](../examples/party-engine/README.md), [QR invite generator](../examples/party-engine/public/room-invite.js), [standalone package](../examples/party-engine/package.json).
