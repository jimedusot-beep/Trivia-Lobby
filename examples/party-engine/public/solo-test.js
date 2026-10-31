// One-tab testing with real server-authoritative rooms and ordinary guest sockets.
// Deliberately not a new backend "bot" privilege or a minimum-player bypass.
import { renderRace, receiveRaceFrame, disposeRace } from "./race-ui.js";
import { renderTap, receiveTapFrame, disposeTap } from "./tap-ui.js";

const $ = id => document.getElementById(id);
const games = {
  quiz: { title: "Trivia Quiz", players: 3, description: "Answer real quiz rounds while two demo rivals answer automatically." },
  race: { title: "Party Grand Prix", players: 2, description: "Watch the real TV race and steer your kart from this page." },
  tap: { title: "Tap Dash", players: 2, description: "Tap against a simulated rival through three real server-scored heats." },
};
const endpoint = new URL("socket", new URL("./", location.href));
endpoint.protocol = location.protocol === "https:" ? "wss:" : "ws:";

let host = null, human = null, bots = [], clients = [], active = false;
let stageKey = "", playerKey = "", mode = "", loop = null, lastTap = 0;
let steer = 0, drifting = false;
const text = value => String(value == null ? "" : value);
const info = value => { $("solo-status").textContent = value; };
function line(parent, tag, content, className) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content !== undefined) node.textContent = content;
  parent.append(node);
  return node;
}
function makeButton(parent, label, onClick, disabled = false) {
  const node = line(parent, "button", label);
  node.type = "button";
  node.disabled = disabled;
  node.addEventListener("click", onClick);
  return node;
}
function stop() {
  active = false;
  if (loop) clearInterval(loop);
  loop = null;
  for (const client of clients) {
    try { client.ws.close(1000, "Solo test ended"); } catch {}
  }
  clients = []; host = null; human = null; bots = [];
  stageKey = ""; playerKey = ""; mode = "";
  disposeRace(); disposeTap();
  $("solo-stage").hidden = true;
  $("solo-start").disabled = false;
  $("solo-stop").disabled = true;
  $("solo-setup").hidden = false;
  $("content").replaceChildren();
  $("solo-controls").replaceChildren();
  $("solo-room").textContent = "";
  info("Test mode is idle. No real players are needed.");
}
function connect(hello) {
  return new Promise((resolve, reject) => {
    let finished = false;
    const client = { ws: null, actor: null, state: null, seq: 0, autoKey: "" };
    const ws = new WebSocket(endpoint.href);
    client.ws = ws;
    clients.push(client);
    const timer = setTimeout(() => {
      if (!finished) { finished = true; reject(new Error("Connection timed out.")); ws.close(); }
    }, 12000);
    ws.addEventListener("open", () => {
      if (!active) { ws.close(1000, "Solo test cancelled"); return; }
      ws.send(JSON.stringify(hello));
    });
    ws.addEventListener("message", event => {
      let frame;
      try { frame = JSON.parse(event.data); } catch { return; }
      if (frame.type === "credential") client.actor = frame.actor;
      if (frame.type === "state") {
        client.state = frame.state;
        if (!finished) { finished = true; clearTimeout(timer); resolve(client); }
        if (active) {
          if (client === host) { renderHost(); updateScores(); }
          if (client === human) renderController();
          if (bots.includes(client)) autoAnswer(client);
        }
      } else if (frame.type === "race_frame" && client === host) receiveRaceFrame(frame);
      else if (frame.type === "tap_frame" && client === host) receiveTapFrame(frame);
      else if (frame.type === "tap_frame" && client === human) {
        const counter = $("solo-taps");
        if (counter) counter.textContent = text(frame.own?.taps ?? 0);
      } else if (frame.type === "error") {
        if (!finished) { finished = true; clearTimeout(timer); reject(new Error(frame.message)); }
        else if (active && client === human) info("Test action: " + frame.message);
      }
    });
    ws.addEventListener("close", () => {
      if (!finished) { finished = true; clearTimeout(timer); reject(new Error("Server connection closed.")); }
      else if (active && (client === human || client === host)) info("Test connection ended. Choose Stop and restart.");
    });
    ws.addEventListener("error", () => {
      if (!finished) { finished = true; clearTimeout(timer); reject(new Error("Unable to connect to the party server.")); }
    });
  });
}
function action(client, type, value) {
  const state = client?.state;
  if (!state || client.ws.readyState !== WebSocket.OPEN) return false;
  const message = { v: 1, type, requestId: crypto.randomUUID(), matchId: state.matchId, revision: state.revision };
  if (value !== undefined) message.value = value;
  client.ws.send(JSON.stringify(message));
  return true;
}
function autoAnswer(bot) {
  const state = bot.state;
  if (mode !== "quiz" || state?.phase !== "question" || state.locked || !state.question) return;
  const key = state.matchId + ":" + state.index;
  if (bot.autoKey === key) return;
  bot.autoKey = key;
  action(bot, "answer", Math.floor(Math.random() * state.question.choices.length));
}
function sendRace(client, item = false, bot = false) {
  const state = client?.state;
  if (!state || state.phase !== "playing" || state.pack?.kind !== "race" ||
      client.ws.readyState !== WebSocket.OPEN) return;
  client.ws.send(JSON.stringify({
    v: 1, type: "race_input", matchId: state.matchId, heat: state.index, seq: client.seq++,
    steer: bot ? Math.sin(performance.now() / 1700) * .24 : steer,
    drift: bot ? false : drifting, item, assist: true,
  }));
}
function sendTap(client) {
  const state = client?.state;
  if (!state || state.phase !== "playing" || state.pack?.kind !== "tap" ||
      client.ws.readyState !== WebSocket.OPEN) return;
  client.ws.send(JSON.stringify({ v: 1, type: "tap_input", matchId: state.matchId, heat: state.index, seq: client.seq++ }));
}
function updateScores() {
  if (!host?.state) return;
  const list = $("solo-players");
  list.replaceChildren();
  for (const player of host.state.players) {
    line(list, "li", player.name + " — " + player.score + " points" + (player.connected ? "" : " (offline)"));
  }
}
function renderHost() {
  const state = host?.state;
  if (!state) return;
  const key = state.matchId + ":" + state.mode + ":" + state.phase + ":" + state.index;
  if (key !== stageKey) {
    stageKey = key;
    disposeRace(); disposeTap();
    const root = $("content");
    root.replaceChildren();
    if (state.pack?.kind === "race" && ["playing", "reveal", "finished"].includes(state.phase)) {
      renderRace(state, { sendInput() {} });
    } else if (state.pack?.kind === "tap" && ["playing", "reveal", "finished"].includes(state.phase)) {
      renderTap(state, { sendInput() {} });
    } else if (state.question) {
      line(root, "h2", state.question.prompt);
      const choices = line(root, "ol");
      state.question.choices.forEach((answer, index) => line(choices, "li",
        String.fromCharCode(65 + index) + ". " + answer + (state.phase === "reveal" && index === state.question.correct ? " ✓" : "")));
      if (state.phase === "reveal") line(root, "p", "Answers revealed. Continue when ready.");
    } else {
      line(root, "h2", state.phase === "countdown" ? "Get ready!" :
        state.phase === "finished" ? "Match complete!" : "Preparing real game room…");
    }
  }
  $("solo-phase").textContent = "Phase: " + state.phase + (state.index != null ? " · Round " + (state.index + 1) : "");
  $("solo-room").textContent = "Temporary test room: " + state.code;
  $("solo-next").hidden = !["reveal", "finished"].includes(state.phase);
  $("solo-next").textContent = state.phase === "finished" ? "Back to lobby" : "Next round";
}
function renderController() {
  const state = human?.state;
  if (!state) return;
  const key = state.matchId + ":" + state.phase + ":" + state.index + ":" + text(state.locked);
  if (key === playerKey) return;
  playerKey = key;
  const box = $("solo-controls");
  box.replaceChildren();
  line(box, "p", "You're playing as " + (state.players.find(p => p.id === human.actor)?.name || "You") + ". Your inputs are checked by the real game server.");
  if (state.phase === "question" && state.question) {
    line(box, "h3", state.question.prompt);
    state.question.choices.forEach((answer, index) => makeButton(box, String.fromCharCode(65 + index) + ". " + answer,
      () => { action(human, "answer", index); }, !!state.locked));
    if (state.locked) line(box, "p", "Your answer is locked.");
  } else if (state.pack?.kind === "tap" && state.phase === "playing") {
    const counter = line(box, "strong", text(state.pack.own?.taps ?? 0), "solo-tap-count");
    counter.id = "solo-taps";
    makeButton(box, "TAP!", () => {
      const now = performance.now();
      if (now - lastTap < 80) return;
      lastTap = now; sendTap(human);
    }).className = "solo-tap-action";
  } else if (state.pack?.kind === "race" && state.phase === "playing") {
    line(box, "p", "Steering assist is on. The kart accelerates automatically.");
    const steering = line(box, "div", undefined, "solo-steering");
    for (const [value, label] of [[-1,"← Left"],[0,"Straight"],[1,"Right →"]]) {
      const choice = makeButton(steering, label, () => {
        steer = value; sendRace(human);
        for (const item of steering.children) item.setAttribute("aria-pressed", String(item === choice));
      });
      choice.setAttribute("aria-pressed", String(value === steer));
    }
    const drift = makeButton(box, "Drift: off", () => {
      drifting = !drifting; drift.textContent = drifting ? "Drift: on" : "Drift: off";
      drift.setAttribute("aria-pressed", String(drifting)); sendRace(human);
    });
    drift.setAttribute("aria-pressed", String(drifting));
    makeButton(box, "Use item", () => sendRace(human, true));
  } else {
    line(box, "p", state.phase === "finished" ? "Your test is complete. Check the results or return to lobby." :
      state.phase === "reveal" ? "Result displayed on the TV stage. Use Next round to continue." :
      "Waiting for the next round…");
  }
}
async function start() {
  if (active || clients.length) return;
  const chosen = $("solo-mode").value;
  if (!Object.hasOwn(games, chosen)) return;
  mode = chosen; active = true;
  steer = 0; drifting = false; lastTap = 0;
  $("solo-start").disabled = true;
  $("solo-stop").disabled = false;
  $("solo-setup").hidden = true;
  $("solo-stage").hidden = false;
  info("Creating a temporary test room…");
  try {
    host = await connect({ type: "create" });
    if (!active) throw new Error("Test stopped.");
    const code = host.state.code;
    info("Joining virtual players…");
    human = await connect({ type: "join", code, name: "You" });
    if (!active) throw new Error("Test stopped.");
    for (let i = 1; i < games[mode].players; i++) {
      const bot = await connect({ type: "join", code, name: "Demo Rival " + i });
      if (!active) throw new Error("Test stopped.");
      bots.push(bot);
    }
    // The room is genuinely server-authoritative: use the normal minimum,
    // rather than adding special test privileges or fake player counts.
    const deadline = Date.now() + 8000;
    while ((host.state?.players.filter(p => p.connected).length || 0) < games[mode].players) {
      if (!active) throw new Error("Test stopped.");
      if (Date.now() > deadline) throw new Error("Player seats were not confirmed.");
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (!active) throw new Error("Test stopped.");
    info("Test room ready. Starting " + games[mode].title + "…");
    if (!action(host, "start", mode)) throw new Error("Unable to start the real game.");
    renderHost();
    renderController();
    loop = setInterval(() => {
      if (!active) return;
      if (mode === "race") {
        sendRace(human);
        for (const bot of bots) sendRace(bot, false, true);
      }
      if (mode === "tap") for (const bot of bots) sendTap(bot);
    }, mode === "tap" ? 330 : 240);
  } catch (error) {
    const cancelled = !active;
    stop();
    if (!cancelled) info("Could not start solo test: " + (error instanceof Error ? error.message : "Unknown error."));
  }
}
$("solo-mode").addEventListener("change", () => {
  const selected = games[$("solo-mode").value];
  $("solo-description").textContent = selected.description + " A host and " + selected.players +
    " player connections are opened in this one tab.";
});
$("solo-mode").dispatchEvent(new Event("change"));
$("solo-start").addEventListener("click", start);
$("solo-stop").addEventListener("click", () => { stop(); info("Solo test stopped. Start another game whenever you like."); });
$("solo-next").addEventListener("click", () => {
  if (host?.state?.phase === "reveal") action(host, "next");
  else if (host?.state?.phase === "finished") action(host, "lobby");
});
addEventListener("pagehide", () => { active = false; for (const client of clients) try { client.ws.close(); } catch {} });
