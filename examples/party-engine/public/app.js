let ws,
  state,
  credential,
  pending,
  offset = 0,
  retryTimer,
  phaseKey = "";
const $ = (id) => document.getElementById(id);
const status = (text) => {
  $("status").textContent = text;
};
try {
  credential = JSON.parse(sessionStorage.getItem("party-credential"));
} catch {}
$("code").value = new URLSearchParams(location.search).get("code") || "";
function save() {
  try {
    sessionStorage.setItem("party-credential", JSON.stringify(credential));
  } catch {
    status(
      "Storage unavailable: keep this tab open to preserve your reconnect credential.",
    );
  }
}
function connect(hello) {
  clearTimeout(retryTimer);
  ws = new WebSocket(
    `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/socket`,
  );
  ws.onopen = () => {
    status("Connected.");
    if (credential) ws.send(JSON.stringify({ type: "resume", ...credential }));
    else if (hello) ws.send(JSON.stringify(hello));
  };
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.type === "credential") {
      credential = { code: m.code, actor: m.actor, token: m.token };
      save();
      status("Party ready.");
    }
    if (m.type === "ready") {
      status("Reconnected.");
      if (pending) ws.send(JSON.stringify(pending));
    }
    if (m.type === "state") {
      state = m.state;
      offset = state.serverNow - Date.now();
      render();
      if (pending) {
        clearTimeout(retryTimer);
        retryTimer = setTimeout(() => {
          if (pending && ws.readyState === 1) ws.send(JSON.stringify(pending));
        }, 2000);
      }
    }
    if (m.type === "ack") {
      pending = null;
      clearTimeout(retryTimer);
      status("Submission accepted.");
      render();
    }
    if (m.type === "error") {
      pending = null;
      clearTimeout(retryTimer);
      status(m.message);
      if (!state && credential) {
        credential = null;
        save();
        ws.close();
      }
      if (state) render();
    }
  };
  ws.onclose = () => {
    status("Disconnected. Reconnecting…");
    if (credential) retryTimer = setTimeout(() => connect(), 2000);
  };
}
function hello(message) {
  if (ws?.readyState === 1) ws.send(JSON.stringify(message));
  else connect(message);
}
$("create").onclick = () => hello({ type: "create" });
$("join").onsubmit = (e) => {
  e.preventDefault();
  hello({
    type: "join",
    code: $("code").value.trim().toUpperCase(),
    name: $("name").value.trim(),
  });
};
$("leave").onclick = () => {
  credential = null;
  save();
  ws.close();
  location.href = "/";
};
function action(type, value, promptIndex) {
  if (pending || ws.readyState !== 1) {
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
  const focusedId = document.activeElement?.id;
  const selectionStart = document.activeElement?.selectionStart;
  const selectionEnd = document.activeElement?.selectionEnd;
  const selectedMode = $("mode")?.value || "quiz";
  const previousPhase = phaseKey;
  $("entry").hidden = true;
  $("game").hidden = false;
  $("content").replaceChildren();
  const host = state.role === "host";
  $("heading").textContent = `${state.code} · ${state.phase}`;
  const key = `${state.matchId}:${state.phase}:${state.index}`;
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
    element("p", `Join link: ${location.origin}/?code=${state.code}`);
    element(
      "p",
      "Quiz: 5 questions, 30 seconds each, 100 points per correct answer. Prompt Duel: 90 seconds to write two responses, then 20 seconds per vote. Authors do not vote on their own matchup.",
    );
    if (host) {
      const label = element("label", "Game mode");
      label.htmlFor = "mode";
      const select = element("select");
      select.id = "mode";
      for (const [value, text] of [
        ["quiz", "Quiz"],
        ["duel", "Prompt Duel"],
      ]) {
        const o = element("option", text, select);
        o.value = value;
      }
      select.value = selectedMode;
      button(
        "Start match",
        () => action("start", select.value),
        undefined,
        state.players.filter((p) => p.connected).length < 3,
      );
    } else element("p", "Waiting for the host to start.");
  }
  if (state.phase === "countdown") element("p", "Get ready!");
  if (state.question) {
    element("h3", state.question.prompt);
    state.question.choices.forEach((choice, i) => {
      if (state.phase === "question" && !host)
        button(choice, () => action("answer", i), undefined, state.locked);
      else
        element(
          "p",
          `${choice}${state.question.correct === i ? " ✓ Correct" : ""}`,
        );
    });
    if (state.locked) element("p", "Answer locked.");
    if (state.question.explanation) element("p", state.question.explanation);
    element("p", `${state.received} answers received.`);
  }
  if (state.phase === "writing") {
    element("p", `${state.received} of ${state.expected} responses locked.`);
    for (const a of state.assignments) {
      const box = element("article");
      element("h3", a.prompt, box);
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
    element("h3", state.prompt);
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
  if (state.phase === "reveal" && host) button("Next", () => action("next"));
  if (state.phase === "finished") {
    element(
      "p",
      state.interrupted
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
  for (const p of state.players)
    element(
      "li",
      `${p.name}: ${p.score} points${p.connected ? "" : " · disconnected"}`,
      $("roster"),
    );
  if (previousPhase === phaseKey && focusedId && $(focusedId)) {
    const focused = $(focusedId);
    focused.focus();
    if (typeof selectionStart === "number" && focused.setSelectionRange) {
      focused.setSelectionRange(selectionStart, selectionEnd);
    }
  }
}
setInterval(() => {
  if (!state) return;
  $("timer").textContent = state.deadline
    ? `${Math.max(0, Math.ceil((state.deadline - Date.now() - offset) / 1000))} seconds remaining`
    : "";
}, 200);
connect();
