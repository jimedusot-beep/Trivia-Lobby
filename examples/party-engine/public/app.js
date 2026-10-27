import { celebrate } from "./party-ui.js";
import { createRecoveringConnection } from "./connection-recovery.js";
import { guestInvitation, mountRoomInvitation } from "./room-invite.js";
import { renderSocial } from "./social-ui.js";
import { renderBonus } from "./bonus-ui.js";
import { guestGames, mountGamePicker, gameById } from "./game-catalog.js";
import { mountInvitationEntry } from "./invitation-entry.js";
import { renderPack, drawingBusy } from "./pack-ui.js";
import { renderRace, updateRaceState, receiveRaceFrame, disposeRace, releaseRaceControls } from "./race-ui.js";
import { renderTap, updateTapState, receiveTapFrame, disposeTap } from "./tap-ui.js";

let invitationCode, invitationPhase;
const launchGame = new URLSearchParams(location.search).get("game");
let preferredMode = gameById(launchGame) ? launchGame : "quiz";
let preferredCategory = "actions";
let preferredSettings = {};

let connection, roomReady = false;
let ws,
  state,
  credential,
  pending,
  offset = 0,
  retryTimer,
  phaseKey = "";
// Works both at /party/ in the main app and at / in the standalone demo.
const partyUrl = new URL("./", location.href);
const credentialKey = `party-credential:${partyUrl.pathname}`;
const preferenceKey = `party-host-choice:${partyUrl.pathname}`;
const $ = (id) => document.getElementById(id);
const status = (text) => {
  $("status").textContent = text;
};
try {
  credential = JSON.parse(sessionStorage.getItem(credentialKey));
} catch {}
try {
  const saved = JSON.parse(sessionStorage.getItem(preferenceKey));
  if (credential?.actor === "host" && saved?.code === credential.code) {
    if (gameById(saved.mode)) preferredMode = saved.mode;
    if (["actions", "animals"].includes(saved.category))
      preferredCategory = saved.category;
    if (saved.settings && typeof saved.settings === "object") preferredSettings = saved.settings;
  }
} catch {}
if (gameById(launchGame)) { credential = null; preferredMode = launchGame; }
const entry = mountInvitationEntry({ search: location.search, savedParty: credential, partyUrl });
let resumeSavedParty = entry.resumeSavedParty;
function saveHostChoice(mode = preferredMode, category = preferredCategory) {
  preferredMode = mode;
  preferredCategory = category;
  if (credential?.actor !== "host") return;
  try {
    sessionStorage.setItem(preferenceKey, JSON.stringify({
      code: credential.code, mode, category, settings: preferredSettings,
    }));
  } catch {}
}
function save() {
  try {
    sessionStorage.setItem(credentialKey, JSON.stringify(credential));
  } catch {
    status(
      "Storage unavailable: keep this tab open to preserve your reconnect credential.",
    );
  }
}
function connect(hello) {
  clearTimeout(retryTimer);
  connection?.stop();
  const socketUrl = new URL("socket", partyUrl);
  socketUrl.protocol = location.protocol === "https:" ? "wss:" : "ws:";
  let resumed = false;
  connection = createRecoveringConnection(socketUrl.href, {
    onOpen(socket) {
      resumed = false;
      ws = socket;
      if (credential && resumeSavedParty) {
        status("Restoring your party…");
        socket.send(JSON.stringify({ type: "resume", ...credential }));
      } else {
        connection.ready(); status("Connected.");
        if (hello) { socket.send(JSON.stringify(hello)); hello = null; }
      }
    },
    onStatus(next) {
      roomReady = next === "connected";
      if (!roomReady) { releaseRaceControls(); disposeTap(); }
      if (!roomReady && state) render();
    },
    onMessage(e, socket) {
      let m;
      try { m = JSON.parse(e.data); } catch { return; }
      if (m.type === "race_frame") { receiveRaceFrame(m); return; }
      if (m.type === "tap_frame") { receiveTapFrame(m); return; }
      if (m.type === "credential") {
        credential = { code: m.code, actor: m.actor, token: m.token };
        resumeSavedParty = true;
        if (m.actor !== "host") history.replaceState(null, "", guestInvitation(location.href, m.code));
        save(); saveHostChoice();
        if (m.actor === "host" && gameById(launchGame)) history.replaceState(null, "", partyUrl.pathname);
        status("Joining your party…");
      }
      if (m.type === "ready") { resumed = true; status("Synchronizing your party…"); }
      if (m.type === "state") {
        const resuming = !roomReady;
        state = m.state; offset = state.serverNow - Date.now();
        connection.ready();
        // Only announce initial room synchronization. Routine state broadcasts
        // must not overwrite a successful action ACK or an actionable error.
        if (resuming) status(resumed ? "Reconnected." : "Party ready.");
        render();
        if (pending) {
          if (resuming) socket.send(JSON.stringify(pending));
          clearTimeout(retryTimer);
          retryTimer = setTimeout(() => { if (pending && roomReady && ws.readyState === 1) ws.send(JSON.stringify(pending)); }, 2000);
        }
      }
      if (m.type === "ack" && m.requestId === pending?.requestId) {
        pending = null; clearTimeout(retryTimer); status("Submission accepted."); render();
      }
      if (m.type === "error") {
        const temporary = /recovery.*(saved|unavailable)|temporarily unavailable/i.test(m.message);
        if (!temporary) { pending = null; clearTimeout(retryTimer); }
        status(m.message);
        if (!state) entry.showError(m.message);
        if (!temporary && !state && credential && resumeSavedParty) {
          credential = null; resumeSavedParty = false; save(); connection.stop();
        }
        if (state) render();
      }
    },
    onClose(event, retrying) {
      clearTimeout(retryTimer);
      releaseRaceControls(); disposeTap();
      status(retrying ? "Disconnected. Reconnecting…" : event.reason || "This party session ended. Join again to continue.");
      if (!retrying) { pending = null; if (!state) entry.showError(event.reason || "This session ended. Join again."); }
      if (state) render();
    },
  });
  ws = connection.socket;
}
function hello(message) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
  else if (ws?.readyState === WebSocket.CONNECTING) {
    // Avoid opening a second socket on a fast tap before the initial connect.
    const socket = ws;
    socket.addEventListener("open", () => {
      if (socket === ws && (!credential || !resumeSavedParty)) socket.send(JSON.stringify(message));
    }, { once: true });
  } else connect(message);
}
$("create").onclick = async () => {
  const localId = new URLSearchParams(location.search).get("deck");
  if (!localId) {
    let show;
    try { if (preferredMode === "feud") show = JSON.parse(sessionStorage.getItem("party-custom-show")); } catch {}
    return hello({ type: "create", ...(show ? { show } : {}) });
  }
  try {
    const { getGuestDeck, validateLocalDeck } = await import("./guest-decks.js");
    const record = await getGuestDeck(localId);
    if (!record) throw new Error("Saved quiz not found on this device. Return to Make a Quiz.");
    const quiz = validateLocalDeck(record);
    hello({ type: "create", quiz });
  } catch (error) {
    status(error instanceof Error ? error.message : "Cannot open saved quiz.");
  }
};
$("join").onsubmit = (e) => {
  e.preventDefault();
  entry.clearError();
  hello({
    type: "join",
    code: $("code").value.trim().toUpperCase(),
    name: $("name").value.trim(),
  });
};
$("leave").onclick = () => {
  credential = null;
  save();
  try { sessionStorage.removeItem(preferenceKey); } catch {}
  connection?.stop();
  location.href = partyUrl.href;
};
function action(type, value, promptIndex) {
  if (pending || !roomReady || ws?.readyState !== 1) {
    status("Wait for the connection or current submission.");
    return;
  }
  pending = {
    v: 1,
    type,
    requestId: Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join(""),
    matchId: state.matchId,
    revision: state.revision,
  };
  if (value !== undefined) pending.value = value;
  if (promptIndex !== undefined) pending.promptIndex = promptIndex;
  if (type === "start" && value === "charades")
    pending.category = $("charades-category").value;
  if (type === "start" && ["colors", "table"].includes(value)) pending.settings = preferredSettings[value] || {};
  if (type === "mark") pending.clueId = state.charades.clue.id;
  ws.send(JSON.stringify(pending));
  status("Sending…");
  render();
  retryTimer = setTimeout(() => {
    if (pending && ws.readyState === 1) ws.send(JSON.stringify(pending));
  }, 2000);
}
function element(tag, text, parent = $("content")) {
  const e = document.createElement(tag);
  if (text !== undefined) e.textContent = text;
  parent.append(e);
  return e;
}
function button(text, fn, parent, disabled = false) {
  const b = element("button", text, parent);
  b.disabled = disabled || !!pending;
  b.onclick = fn;
  return b;
}
function render() {
  if (drawingBusy() && state.phase === "playing" && state.pack?.kind === "draw" && state.pack.canDraw) return;
  if (updateRaceState(state)) return;
  if (updateTapState(state)) return;
  disposeRace();
  disposeTap();
  const focusedId = document.activeElement?.id;
  const selectionStart = document.activeElement?.selectionStart;
  const selectionEnd = document.activeElement?.selectionEnd;
  const selectedMode = $("mode")?.value || preferredMode;
  const selectedCategory = $("charades-category")?.value || preferredCategory;
  const previousPhase = phaseKey;
  document.body.classList.add("party-playing");
  document.body.classList.remove("party-invited");
  document.body.dataset.partyPhase = state.phase;
  $("entry").hidden = true;
  $("pick-games").hidden = true;
  $("game").hidden = false;
  $("content").replaceChildren();
  const host = state.role === "host";
  const invitation = $("party-invitation");
  invitation.hidden = false;
  if (invitationCode !== state.code) {
    $("invitation-card").replaceChildren();
    mountRoomInvitation($("invitation-card"), { url: guestInvitation(location.href, state.code), code: state.code });
    invitationCode = state.code;
    invitation.open = host && state.phase === "lobby";
  } else if (invitationPhase === "lobby" && state.phase !== "lobby") invitation.open = false;
  else if (invitationPhase !== "lobby" && state.phase === "lobby" && host) invitation.open = true;
  invitationPhase = state.phase;
  $("heading").textContent = `${state.code} · ${state.phase}`;
  const key = `${state.matchId}:${state.phase}:${state.index}:${state.charades?.clue?.id ?? ""}`;
  if (key !== phaseKey) {
    phaseKey = key;
    $("heading").focus();
  }
  if (!state.hostConnected)
    element(
      "p",
      "Host disconnected. Timed play continues; afterward we wait up to 60 seconds for the host.",
    );
  if (state.phase === "lobby") {
    element(
      "p",
      `Quiz (${state.quizTitle}): ${state.quizLength} questions. Each round shows its timer and point value.`,
    );
    const rules = element("details");
    rules.className = "mode-rules";
    element("summary", "How these games work", rules);
    element("p", "Prompt Duel: 90 seconds to write two responses, then 20 seconds per vote. Authors do not vote on their own matchup. Charades: each player acts for up to 60 seconds, marks Correct (+1) or Pass (0), then everyone sees the round summary.", rules);
    if (host) {
      const label = element("label", "Game mode");
      label.htmlFor = "mode";
      const select = element("select");
      select.id = "mode";
      for (const { id: value, name: text } of guestGames) {
        const o = element("option", text, select);
        o.value = value;
      }
      select.value = selectedMode;
      const packLabel = element("label", "Charades pack");
      packLabel.htmlFor = "charades-category";
      const pack = element("select");
      pack.id = "charades-category";
      for (const [value, text] of [
        ["actions", "Everyday actions"],
        ["animals", "Animals"],
      ]) {
        const option = element("option", text, pack);
        option.value = value;
      }
      pack.value = selectedCategory;
      const showPack = () => {
        pack.hidden = packLabel.hidden = select.value !== "charades";
      };
      const selection = element("p");
      selection.className = "pick-game-selection";
      const showSelection = () => {
        selection.textContent = `Ready to host: ${gameById(select.value)?.name ?? "Trivia Quiz"} · ${state.players.filter(p => p.connected).length} connected · ${gameById(select.value)?.min ?? 3}–20 needed.`;
      };
      select.onchange = () => {
        saveHostChoice(select.value, pack.value);
        showPack();
        showSelection();
        showSettings();
      };
      pack.onchange = () => saveHostChoice(select.value, pack.value);
      showPack();
      showSelection();
      const settingsBox = element("div"); settingsBox.className = "pack-settings";
      const settingsSelect = (label, key, options, mode, fallback) => {
        const caption = element("label", label, settingsBox);
        const field = element("select", undefined, settingsBox); field.id = `pack-setting-${key}`; caption.htmlFor = field.id;
        for (const [value, title] of options) { const option = element("option", title, field); option.value = String(value); }
        field.value = String(preferredSettings[mode]?.[key] ?? fallback);
        field.onchange = () => { preferredSettings[mode] ||= {}; preferredSettings[mode][key] = key === "preset" ? field.value : key === "stacking" ? field.value === "true" : Number(field.value); saveHostChoice(); };
      };
      function showSettings() {
        settingsBox.replaceChildren();
        if (select.value === "colors") {
          settingsSelect("Computer players (up to ten total seats)", "bots", Array.from({ length: 9 }, (_, i) => [i, String(i)]), "colors", 0);
          settingsSelect("Draw-card stacking", "stacking", [[false,"Off"],[true,"On"]], "colors", false);
          settingsSelect("Seconds per card turn", "turnSeconds", [15,30,60,90].map(n=>[n,String(n)]), "colors", 30);
        }
        if (select.value === "table") settingsSelect("Card-table preset", "preset", [["poker","Five-card poker (manual rules)"],["whist","Whist (four seats, manual rules)"]], "table", "poker");
        if (select.value === "feud") { const link = element("a", "Make or import your own showdown questions", settingsBox); link.href = "./show.html"; }
        start.disabled = state.players.filter(p=>p.connected).length < (gameById(select.value)?.min ?? 3) || !!pending;
      }
      const start = button(
        "Start match",
        () => action("start", select.value),
        undefined,
        state.players.filter((p) => p.connected).length < (gameById(select.value)?.min ?? 3),
      );
      showSettings();
    } else element("p", "Waiting for the host to start.");
  }
  if (state.phase === "countdown") element("p", "Get ready!");
  if (state.question) {
    element("h2", state.question.prompt);
    element("p", `${state.question.seconds} seconds · ${state.question.points} points${state.question.penalty ? ` · ${state.question.penalty} wrong-answer penalty` : ""}`);
    state.question.choices.forEach((choice, i) => {
      let tile;
      if (state.phase === "question" && !host)
        tile = button(choice, () => action("answer", i), undefined, state.locked);
      else
        tile = element(
          "p",
          `${choice}${state.question.correct === i ? " ✓ Correct" : ""}`,
        );
      tile.className = "answer-tile";
      tile.dataset.answerTone = String(i);
      tile.dataset.correct = String(state.question.correct === i);
      const letter = document.createElement("span");
      letter.className = "answer-letter";
      letter.setAttribute("aria-hidden", "true");
      letter.textContent = String.fromCharCode(65 + i);
      tile.prepend(letter);
    });
    if (state.locked) element("p", "Answer locked.");
    if (state.question.explanation) element("p", state.question.explanation);
    element("p", `${state.received} answers received.`);
  }
  if (state.social) renderSocial(state,{element,button,action,actor:()=>credential?.actor});
  if (state.bonus) renderBonus(state,{element,button,action,actor:()=>credential?.actor});
  if (state.pack?.kind === "race") renderRace(state, { sendInput: frame => { if (roomReady && ws?.readyState === 1) ws.send(JSON.stringify(frame)); } });
  else if (state.pack?.kind === "tap") renderTap(state, { sendInput: frame => { if (roomReady && ws?.readyState === 1) ws.send(JSON.stringify(frame)); } });
  else if (state.pack) renderPack(state,{element,button,action,actor:()=>credential?.actor,refresh:render,canAct:()=>!pending && ws?.readyState === 1});
  if (state.pack && host && state.phase === "playing") button("End this match", () => {
    if (confirm("End this match now? Current points will stay on the results screen.")) action("play", { action: "end-match" });
  });
  if (state.phase === "writing" && state.mode === "duel") {
    element("p", `${state.received} of ${state.expected} responses locked.`);
    for (const a of state.assignments) {
      const box = element("article");
      element("h2", a.prompt, box);
      if (a.locked) element("p", "Response locked.", box);
      else {
        const label = element(
          "label",
          "Your response (240 characters maximum)",
          box,
        );
        const input = element("textarea", undefined, box);
        input.id = `prompt-${a.promptIndex}`;
        label.htmlFor = input.id;
        input.maxLength = 240;
        input.rows = 3;
        const draftKey = `party-draft:${state.matchId}:${a.promptIndex}`;
        try {
          input.value = sessionStorage.getItem(draftKey) || "";
        } catch {}
        input.oninput = () => {
          try {
            sessionStorage.setItem(draftKey, input.value);
          } catch {}
        };
        button(
          "Lock response",
          () => action("write", input.value, a.promptIndex),
          box,
        );
      }
    }
  }
  if (state.prompt) {
    element("h2", state.prompt);
    if (state.skipped)
      element(
        "p",
        "Matchup skipped: a response was missing. No points awarded.",
      );
    for (const o of state.options) {
      if (state.phase === "voting" && state.canVote)
        button(o.text, () => action("vote", o.id));
      else
        element(
          "p",
          o.text + (o.author ? ` — ${o.author}: ${o.votes} votes` : ""),
        );
    }
    if (state.phase === "voting" && !state.canVote)
      element(
        "p",
        host
          ? "Waiting for eligible votes."
          : "Waiting: you have voted or are an author on this matchup.",
      );
  }
  if (state.charades) {
    const c = state.charades;
    element(
      "p",
      `Turn ${c.turnNumber} of ${c.totalTurns} · Performer: ${c.performerName} · ${c.category}`,
    );
    if (state.phase === "acting") {
      if (c.canMark) {
        const clue = element("h2", c.clue.text);
        clue.id = "current-clue";
        clue.tabIndex = -1;
        element(
          "p",
          "Act this out without speaking. Agree with your group before marking Correct. Scoring is self-reported.",
        );
        button("Correct (+1)", () => action("mark", "correct"));
        button("Pass", () => action("mark", "pass"));
      } else
        element(
          "p",
          `Guess what ${c.performerName} is acting. Their clue is private until this turn ends.`,
        );
    }
    if (c.history) {
      element("h2", "Turn summary");
      const list = element("ul");
      for (const mark of c.history)
        element("li", `${mark.text} — ${mark.result}`, list);
    }
  }
  if (state.phase === "reveal" && host) button("Next", () => action("next"));
  if (state.phase === "finished") {
    if (previousPhase !== phaseKey && !state.interrupted && !state.endedByHost) celebrate();
    element(
      "p",
      state.endedByHost ? "The host ended this match early. Current points are shown below." : state.interrupted
        ? "Match interrupted: host did not reconnect."
        : "Match complete! Equal scores share the result.",
    );
    if (state.players.length) {
      const top = state.players[0].score;
      element(
        "p",
        `Leaders: ${state.players
          .filter((p) => p.score === top)
          .map((p) => p.name)
          .join(", ")}`,
      );
    }
    if (host) button("Return to same party", () => action("lobby"));
  }
  $("roster").replaceChildren();
  for (const p of state.players) {
    const row = element("li", undefined, $("roster"));
    const token = element("span", (Array.from(p.name)[0] || "?").toUpperCase(), row);
    token.className = "player-token";
    token.setAttribute("aria-hidden", "true");
    element(
      "span",
      `${p.name}: ${p.score} points${p.connected ? "" : " · disconnected"}`,
      row,
    );
  }
  // One party-wide championship survives every individual game and its score reset.
  const championshipBox = $("championship");
  championshipBox.replaceChildren();
  const championship = state.championship;
  if (championship) {
    element("h2", "🏆 Game Night Championship", championshipBox);
    element("p", `${championship.gamesPlayed} completed games · One shared family leaderboard. Standings survive switching games in this room.`, championshipBox);
    if (championship.standings.length) {
      const ranking = element("ol", undefined, championshipBox);
      ranking.className = "championship-standings";
      for (const [i, player] of championship.standings.entries()) {
        const row = element("li", undefined, ranking);
        element("strong", `#${i + 1} ${player.name}`, row);
        element("span", `${player.points} points · ${player.wins} wins · ${player.games} games`, row);
      }
    } else element("p", "Finish the first game to start collecting championship points.", championshipBox);
    if (championship.recent.length) {
      const heading = element("h3", "Recent games", championshipBox);
      const recentList = element("ul", undefined, championshipBox);
      recentList.className = "championship-recent";
      for (const game of championship.recent) {
        element("li", `${gameById(game.mode)?.name || game.mode}: ${game.winners.length ? game.winners.join(", ") : "No points awarded"}`, recentList);
      }
    }
  }
  if (previousPhase !== phaseKey && $("current-clue"))
    $("current-clue").focus();
  if (previousPhase === phaseKey && focusedId && $(focusedId)) {
    const focused = $(focusedId);
    focused.focus();
    if (typeof selectionStart === "number" && focused.setSelectionRange) {
      focused.setSelectionRange(selectionStart, selectionEnd);
    }
  }
}
mountGamePicker($("game-picker"), { onHost: game => { preferredMode = game; $("create").click(); } });
setInterval(() => {
  if (!state) return;
  $("timer").textContent = state.deadline
    ? `${Math.max(0, Math.ceil((state.deadline - Date.now() - offset) / 1000))} seconds remaining`
    : "";
  $("timer").dataset.urgent = String(!!state.deadline && state.deadline - Date.now() - offset <= 5000);
}, 200);
connect();
if (gameById(launchGame)) $("create").click();
