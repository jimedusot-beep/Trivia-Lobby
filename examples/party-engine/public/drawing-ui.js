// SPDX-License-Identifier: AGPL-3.0-or-later
const palette = [
  ["Ink", "#20264b"],
  ["Rose", "#e23867"],
  ["Blue", "#2477db"],
  ["Green", "#158346"],
  ["Gold", "#f0b83e"],
  ["Purple", "#9455cc"],
  ["Orange", "#ee7625"],
  ["Eraser", "#ffffff"],
];
let active;
export const drawingBusy = () => !!active?.busy;
export function disposeDrawing() {
  if (active) clearInterval(active.timer);
  active = null;
}
function preferences() {
  try {
    const v = JSON.parse(sessionStorage.getItem("doodle-tools"));
    return {
      color: palette.some(([, c]) => c === v?.color) ? v.color : "#20264b",
      width: [4, 8, 16, 24].includes(v?.width) ? v.width : 8,
    };
  } catch {
    return { color: "#20264b", width: 8 };
  }
}
export function renderDrawing(state, { e, b, play, refresh, canAct, getPack }) {
  disposeDrawing();
  const s = state.pack,
    tool = preferences();
  e("h2", `Doodle Dash · ${s.artistName}'s turn`);
  e("p", `Turn ${s.round} / ${s.total} · ${s.solved} correct guesses`);
  if (s.choices) {
    e("h3", "Choose your secret word");
    s.choices.forEach((word, index) =>
      b(word, () => play({ action: "choose", index })),
    );
  } else if (s.stage === "choose")
    e("p", `${s.artistName} is choosing a word. Get ready to guess.`);
  if (s.word)
    e(
      "h3",
      `${state.phase === "reveal" ? "The word was" : "Your private word"}: ${s.word}`,
    );
  else if (s.hint) e("p", `Word pattern: ${s.hint}`);
  if (s.canDraw)
    e(
      "p",
      "Draw the clue without letters or numbers. Your drawing appears on everyone else's screen while you draw.",
    );
  else if (s.hasGuessed && state.phase !== "reveal")
    e(
      "p",
      "You guessed it! Your points are locked. Keep the word secret while the others guess.",
    );
  else if (s.canGuess)
    e("p", `Watch ${s.artistName}'s drawing and type your guess below.`);
  const ns = "http://www.w3.org/2000/svg",
    svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 1000 1000");
  svg.classList.add("doodle-pad");
  svg.setAttribute("role", "img");
  svg.setAttribute(
    "aria-label",
    s.canDraw
      ? "Drawing pad. Use pointer, or arrow keys to move and Enter to draw a line."
      : "Live drawing",
  );
  e("div").append(svg);
  function line(stroke) {
    const path = document.createElementNS(ns, "polyline");
    for (const [key, value] of Object.entries({
      points: stroke.points.map((p) => p.join(",")).join(" "),
      fill: "none",
      stroke: stroke.color,
      "stroke-width": stroke.width,
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
    }))
      path.setAttribute(key, String(value));
    if (stroke.strokeId) path.dataset.strokeId = stroke.strokeId;
    svg.append(path);
    return path;
  }
  for (const stroke of s.strokes) line(stroke);
  if (s.canDraw) {
    svg.tabIndex = 0;
    svg.setAttribute("aria-disabled", String(!canAct()));
    const tools = e("div");
    tools.className = "drawing-tools";
    const color = e("select", undefined, tools);
    color.setAttribute("aria-label", "Pen color");
    for (const [label, value] of palette) {
      const option = e("option", label, color);
      option.value = value;
    }
    color.value = tool.color;
    const width = e("select", undefined, tools);
    width.setAttribute("aria-label", "Pen width");
    for (const n of [4, 8, 16, 24]) {
      const option = e("option", `${n} px`, width);
      option.value = String(n);
    }
    width.value = String(tool.width);
    const save = () => {
      try {
        sessionStorage.setItem(
          "doodle-tools",
          JSON.stringify({ color: color.value, width: Number(width.value) }),
        );
      } catch {}
    };
    color.onchange = save;
    width.onchange = save;
    b("Undo stroke", () => play({ action: "undo" }), tools, !s.canUndo);
    b("Redo stroke", () => play({ action: "redo" }), tools, !s.canRedo);
    b(
      "Clear drawing",
      () => {
        if (confirm("Clear the whole drawing?")) play({ action: "clear" });
      },
      tools,
      !s.canUndo,
    );
    e(
      "p",
      "Use white as an eraser. Pen color and width stay selected between strokes. Keyboard: arrows move the pen; Enter draws a short line.",
    );
    if (s.remainingPoints < 64 || s.remainingSegments < 8)
      e(
        "p",
        "The canvas is nearly full. Undo a stroke or clear the drawing to make more space.",
      );
    const gesture = {
      busy: false,
      down: false,
      points: [],
      preview: null,
      pointer: null,
      part: 0,
      lastSend: 0,
      started: 0,
      sent: false,
    };
    active = gesture;
    const finish = () => {
      gesture.busy = false;
      gesture.down = false;
      refresh();
    };
    const position = (event) => {
      const rect = svg.getBoundingClientRect();
      return [
        Math.max(
          0,
          Math.min(
            1000,
            Math.round(((event.clientX - rect.left) / rect.width) * 1000),
          ),
        ),
        Math.max(
          0,
          Math.min(
            1000,
            Math.round(((event.clientY - rect.top) / rect.height) * 1000),
          ),
        ),
      ];
    };
    function pump(force = false) {
      if (active !== gesture || !gesture.busy) return;
      const latest = getPack();
      if (!latest?.canDraw || !svg.isConnected) {
        disposeDrawing();
        return;
      }
      if (!canAct()) {
        svg.setAttribute("aria-disabled", "true");
        if (!gesture.down && Date.now() - gesture.started > 8000) finish();
        return;
      }
      svg.setAttribute("aria-disabled", "false");
      if (gesture.points.length < 2) {
        if (!gesture.down) finish();
        return;
      }
      if (!force && gesture.down && Date.now() - gesture.lastSend < 250) return;
      let points = gesture.points.map((p) => [...p]);
      const remaining = latest.remainingPoints ?? 2400;
      if ((latest.remainingSegments ?? 200) < 1 || remaining < 2) {
        finish();
        return;
      }
      if (points.length > remaining)
        points = points
          .filter(
            (_, i) =>
              i === 0 ||
              i === points.length - 1 ||
              i % Math.ceil(points.length / Math.max(1, remaining - 2)) === 0,
          )
          .slice(0, remaining);
      const end = points.at(-1);
      gesture.points = [[...end]];
      gesture.lastSend = Date.now();
      gesture.sent = true;
      play({
        action: "stroke",
        points,
        color: gesture.color,
        width: gesture.width,
        strokeId: gesture.id,
        part: gesture.part++,
      });
      svg.setAttribute("aria-disabled", "true");
    }
    gesture.timer = setInterval(() => pump(), 50);
    svg.onpointerdown = (event) => {
      if (event.button !== 0 || !event.isPrimary || !canAct() || gesture.busy)
        return;
      event.preventDefault();
      svg.setPointerCapture(event.pointerId);
      Object.assign(gesture, {
        busy: true,
        down: true,
        pointer: event.pointerId,
        points: [position(event)],
        part: 0,
        sent: false,
        started: Date.now(),
        lastSend: 0,
        color: color.value,
        width: Number(width.value),
        id: Array.from(crypto.getRandomValues(new Uint8Array(16)), (n) =>
          n.toString(16).padStart(2, "0"),
        ).join(""),
      });
      gesture.preview = line({
        points: gesture.points,
        color: gesture.color,
        width: gesture.width,
      });
      gesture.previewPoints = [...gesture.points];
    };
    svg.onpointermove = (event) => {
      if (!gesture.down || event.pointerId !== gesture.pointer) return;
      const pt = position(event),
        last = gesture.points.at(-1);
      if (Math.hypot(pt[0] - last[0], pt[1] - last[1]) < 5) return;
      gesture.points.push(pt);
      gesture.previewPoints.push(pt);
      if (gesture.points.length > 64)
        gesture.points = gesture.points.filter(
          (_, i, a) => i % 2 === 0 || i === a.length - 1,
        );
      if (gesture.previewPoints.length > 1024)
        gesture.previewPoints = gesture.previewPoints.filter(
          (_, i, a) => i % 2 === 0 || i === a.length - 1,
        );
      gesture.preview.setAttribute(
        "points",
        gesture.previewPoints.map((p) => p.join(",")).join(" "),
      );
    };
    function release(event) {
      if (!gesture.down || event.pointerId !== gesture.pointer) return;
      const pt = position(event);
      if (pt.join(",") !== gesture.points.at(-1).join(",") || !gesture.sent)
        gesture.points.push(pt);
      if (gesture.points.length > 64) gesture.points.splice(1, 1);
      gesture.down = false;
      if (svg.hasPointerCapture(event.pointerId))
        svg.releasePointerCapture(event.pointerId);
      pump(true);
    }
    svg.onpointerup = release;
    svg.onpointercancel = release;
    svg.onlostpointercapture = (event) => {
      if (gesture.down) release(event);
    };
    let start = [500, 500],
      end = [500, 500];
    svg.onkeydown = (event) => {
      if (gesture.busy) return;
      const delta = {
        ArrowLeft: [-30, 0],
        ArrowRight: [30, 0],
        ArrowUp: [0, -30],
        ArrowDown: [0, 30],
      }[event.key];
      if (delta) {
        event.preventDefault();
        start = [...end];
        end = [
          Math.max(0, Math.min(1000, end[0] + delta[0])),
          Math.max(0, Math.min(1000, end[1] + delta[1])),
        ];
      }
      if (event.key === "Enter" && canAct()) {
        event.preventDefault();
        play({
          action: "stroke",
          points: [start, end],
          color: color.value,
          width: Number(width.value),
        });
      }
    };
  }
  if (s.canGuess) {
    const form = e("form");
    form.className = "pack-entry";
    const label = e("label", "Guess the drawing", form),
      input = e("input", undefined, form);
    input.id = "drawing-guess";
    input.maxLength = 60;
    input.autocomplete = "off";
    label.htmlFor = input.id;
    const draftKey = `drawing-guess:${state.matchId}:${state.index}`;
    try {
      input.value = sessionStorage.getItem(draftKey) || "";
    } catch {}
    input.oninput = () => {
      try {
        sessionStorage.setItem(draftKey, input.value);
      } catch {}
    };
    const submit = b("Submit", () => {}, form);
    submit.type = "submit";
    form.onsubmit = (event) => {
      event.preventDefault();
      const text = input.value.trim();
      if (!text || !canAct()) return;
      try {
        sessionStorage.removeItem(draftKey);
      } catch {}
      play({ action: "guess", text });
    };
  }
  const guesses = e("ol");
  guesses.className = "drawing-guesses";
  guesses.setAttribute("aria-label", "Recent guesses");
  for (const guess of s.guesses)
    e("li", `${guess.name}: ${guess.text}`, guesses);
  const help = e("details");
  e("summary", "How to play Doodle Dash", help);
  e(
    "p",
    "Each player gets one drawing turn. The artist has 15 seconds to choose a private word, then 60 seconds to draw. Guessers type answers; the word stays hidden until the turn ends. No letters, numbers or saying the answer aloud.",
    help,
  );
  e(
    "p",
    "A correct guess earns 100 points plus the whole seconds remaining; the artist gets 50 points for each successful guesser. A correct guess scores once. The turn ends when everyone guesses correctly or time runs out; the host then advances to the next artist.",
    help,
  );
}
