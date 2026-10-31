// SPDX-License-Identifier: AGPL-3.0-or-later
// Original SVG board and phone controller. Clients choose server-issued moves.
import {
  HOMEWARD_COLORS,
  HOMEWARD_CARDS,
  TRACK_LENGTH,
  LANE_LENGTH,
  ringPoint,
  lanePoint,
  startPoint,
  slideAt,
  positionLabel,
} from "./homeward-geometry.js";
let match,
  focusedTable = 0;
const choices = new Map(),
  letter = (index) => String.fromCharCode(65 + index);
const modeFor = (move) =>
  move.kind === "step" ? (move.steps < 0 ? "back" : "forward") : move.kind;
const modeNames = {
  forward: "Advance",
  back: "Move backward",
  launch: "Launch from Start",
  split: "Split seven",
  swap: "Swap track pawns",
  bump: "Launch and bump",
};
const ns = "http://www.w3.org/2000/svg";
function node(tag, attrs, parent, text) {
  const element = document.createElementNS(ns, tag);
  for (const [key, value] of Object.entries(attrs ?? {}))
    element.setAttribute(key, String(value));
  if (text !== undefined) element.textContent = text;
  parent.append(element);
  return element;
}
function drawBoard(table, parent, e) {
  const figure = e("figure", undefined, parent);
  figure.className = "homeward-board";
  const svg = node(
    "svg",
    {
      viewBox: "0 0 800 800",
      role: "img",
      "aria-labelledby": `homeward-title-${table.index} homeward-desc-${table.index}`,
    },
    figure,
  );
  node(
    "title",
    { id: `homeward-title-${table.index}` },
    svg,
    `Sorry Ish · board ${table.index + 1}`,
  );
  node(
    "desc",
    { id: `homeward-desc-${table.index}` },
    svg,
    table.seats
      .map(
        (seat, index) =>
          `Player ${index + 1}, ${seat.name}, ${HOMEWARD_COLORS[seat.color].name}: ${seat.pawns.map((pawn, p) => `${letter(p)} ${positionLabel(pawn)}`).join(", ")}`,
      )
      .join(". "),
  );
  node(
    "rect",
    {
      x: 3,
      y: 3,
      width: 794,
      height: 794,
      rx: 44,
      fill: "#fffaf0",
      stroke: "#302447",
      "stroke-width": 6,
    },
    svg,
  );
  for (let index = 0; index < TRACK_LENGTH; index++) {
    const [x, y] = ringPoint(index),
      color = HOMEWARD_COLORS[Math.floor(index / 12)];
    node(
      "rect",
      {
        x: x - 23,
        y: y - 23,
        width: 46,
        height: 46,
        rx: 9,
        fill: color.light,
        stroke: "#51405f",
        "stroke-width": 2,
      },
      svg,
    );
    node(
      "text",
      { x: x - 17, y: y - 12, "font-size": 10, fill: "#302447" },
      svg,
      String(index + 1),
    );
  }
  for (let index = 0; index < TRACK_LENGTH; index++) {
    const slide = slideAt(index);
    if (!slide) continue;
    const [x, y] = ringPoint(index),
      [endX, endY] = ringPoint(slide.end),
      dx = (endX - x) / 175,
      dy = (endY - y) / 175;
    const sx = x - dy * 18,
      sy = y + dx * 18,
      ex = endX - dy * 18,
      ey = endY + dx * 18,
      ink = HOMEWARD_COLORS[slide.color].ink;
    node(
      "line",
      {
        x1: sx,
        y1: sy,
        x2: ex,
        y2: ey,
        stroke: ink,
        "stroke-width": 6,
        "stroke-linecap": "round",
      },
      svg,
    );
    node(
      "polygon",
      {
        points: `${ex},${ey} ${ex - dx * 13 - dy * 6},${ey - dy * 13 + dx * 6} ${ex - dx * 13 + dy * 6},${ey - dy * 13 - dx * 6}`,
        fill: ink,
      },
      svg,
    );
  }
  for (let color = 0; color < 4; color++) {
    const palette = HOMEWARD_COLORS[color],
      seat = table.seats.findIndex((value) => value.color === color);
    for (let lane = 0; lane < LANE_LENGTH; lane++) {
      const [x, y] = lanePoint(color, lane);
      node(
        "rect",
        {
          x: x - 20,
          y: y - 20,
          width: 40,
          height: 40,
          rx: 10,
          fill: palette.light,
          stroke: palette.ink,
          "stroke-width": 3,
        },
        svg,
      );
      node(
        "text",
        {
          x,
          y: y + 4,
          "text-anchor": "middle",
          "font-size": 12,
          fill: palette.ink,
        },
        svg,
        String(lane + 1),
      );
    }
    const [hx, hy] = lanePoint(color, LANE_LENGTH);
    node(
      "path",
      {
        d: `M ${hx - 34} ${hy - 17} L ${hx} ${hy - 43} L ${hx + 34} ${hy - 17} V ${hy + 27} H ${hx - 34} Z`,
        fill: palette.light,
        stroke: palette.ink,
        "stroke-width": 4,
      },
      svg,
    );
    node(
      "text",
      {
        x: hx,
        y: hy + 44,
        "text-anchor": "middle",
        "font-size": 12,
        "font-weight": 800,
        fill: palette.ink,
      },
      svg,
      seat >= 0 ? `P${seat + 1} HOME` : "HOME",
    );
    if (seat >= 0) {
      const [sx, sy] = startPoint(color);
      node(
        "rect",
        {
          x: sx - 42,
          y: sy - 34,
          width: 84,
          height: 63,
          rx: 15,
          fill: palette.light,
          stroke: palette.ink,
          "stroke-width": 2,
        },
        svg,
      );
      node(
        "text",
        {
          x: sx,
          y: sy - 42,
          "text-anchor": "middle",
          "font-size": 12,
          "font-weight": 800,
          fill: palette.ink,
        },
        svg,
        `P${seat + 1} START`,
      );
    }
  }
  const card = table.card ?? table.history.at(-1)?.card ?? "?";
  node(
    "rect",
    {
      x: 315,
      y: 307,
      width: 170,
      height: 176,
      rx: 22,
      fill: "#eee5ff",
      stroke: "#4b367a",
      "stroke-width": 4,
    },
    svg,
  );
  node(
    "text",
    {
      x: 400,
      y: 341,
      "text-anchor": "middle",
      "font-size": 14,
      "font-weight": 800,
      fill: "#34234d",
    },
    svg,
    table.card ? "CURRENT CARD" : "LAST CARD",
  );
  node(
    "text",
    {
      x: 400,
      y: 407,
      "text-anchor": "middle",
      "font-size": card === "BUMP" ? 36 : 58,
      "font-weight": 900,
      fill: "#4b367a",
    },
    svg,
    card === "BUMP" ? "BUMP!" : card,
  );
  node(
    "text",
    {
      x: 400,
      y: 446,
      "text-anchor": "middle",
      "font-size": 12,
      fill: "#34234d",
    },
    svg,
    `${table.drawRemaining} in draw pile`,
  );
  node(
    "text",
    {
      x: 400,
      y: 466,
      "text-anchor": "middle",
      "font-size": 12,
      fill: "#34234d",
    },
    svg,
    `${table.discardCount} discarded`,
  );
  table.seats.forEach((seat, index) =>
    seat.pawns.forEach((pawn, pawnIndex) => {
      let point;
      if (pawn.zone === "track") point = ringPoint(pawn.position);
      else if (pawn.zone === "safe")
        point = lanePoint(seat.color, pawn.position);
      else {
        point =
          pawn.zone === "home"
            ? lanePoint(seat.color, LANE_LENGTH)
            : startPoint(seat.color);
        point = [
          point[0] + (pawnIndex % 2 ? 13 : -13),
          point[1] + (pawnIndex < 2 ? -9 : 13),
        ];
      }
      const [x, y] = point,
        ink = HOMEWARD_COLORS[seat.color].ink;
      if (pawn.zone === "start" || pawn.zone === "home") {
        node(
          "circle",
          { cx: x, cy: y, r: 11, fill: ink, stroke: "#fff", "stroke-width": 2 },
          svg,
        );
        node(
          "text",
          {
            x,
            y: y + 3,
            "text-anchor": "middle",
            "font-size": 9,
            "font-weight": 900,
            fill: "#fff",
          },
          svg,
          `${index + 1}${letter(pawnIndex)}`,
        );
        return;
      }
      node(
        "circle",
        {
          cx: x,
          cy: y - 8,
          r: 8,
          fill: ink,
          stroke: "#fff",
          "stroke-width": 2,
        },
        svg,
      );
      node(
        "path",
        {
          d: `M ${x - 7} ${y - 1} L ${x - 12} ${y + 15} Q ${x} ${y + 20} ${x + 12} ${y + 15} L ${x + 7} ${y - 1} Z`,
          fill: ink,
          stroke: "#fff",
          "stroke-width": 2,
        },
        svg,
      );
      node(
        "text",
        {
          x,
          y: y + 11,
          "text-anchor": "middle",
          "font-size": 9,
          "font-weight": 900,
          fill: "#fff",
        },
        svg,
        `${index + 1}${letter(pawnIndex)}`,
      );
    }),
  );
  e(
    "figcaption",
    "Clockwise track · arrow bars are slides · pawn labels show player number and letter.",
    figure,
  );
}
function remembered(panel, key, initial = false) {
  let open = initial;
  try {
    const stored = sessionStorage.getItem(key);
    if (stored !== null) open = stored === "yes";
  } catch {}
  panel.open = open;
  panel.ontoggle = () => {
    try {
      sessionStorage.setItem(key, panel.open ? "yes" : "no");
    } catch {}
  };
}
export function tickHomewardClocks(now) {
  for (const clock of document.querySelectorAll("[data-homeward-time]")) {
    const remaining = Math.max(
      0,
      Math.ceil((Number(clock.dataset.homewardTime) - now) / 1000),
    );
    clock.textContent = `${remaining}s left in this turn`;
    clock.dataset.urgent = String(remaining <= 5);
  }
}
export function renderHomeward(state, { root, e, b, play, refresh, canAct }) {
  const pack = state.pack,
    host = state.role === "host";
  if (match !== state.matchId) {
    match = state.matchId;
    choices.clear();
    focusedTable = 0;
  }
  root.classList.add(
    "homeward-game",
    host ? "homeward-host" : "homeward-phone",
  );
  e("h2", "Sorry Ish");
  e(
    "p",
    `Card & pawn race · ${pack.tableCount} board${pack.tableCount === 1 ? "" : "s"} · four pawns each`,
  ).className = "homeward-meta";
  let table = pack.tables[0];
  if (host && pack.tables.length > 1) {
    const label = e("label", "Board on the shared screen"),
      select = e("select");
    select.id = "homeward-tv-table";
    label.htmlFor = select.id;
    for (const option of pack.tables) {
      const opt = e(
        "option",
        `Board ${option.index + 1}: ${option.seats.map((s) => s.name).join(" / ")}`,
        select,
      );
      opt.value = String(option.index);
    }
    if (!pack.tables.some((value) => value.index === focusedTable))
      focusedTable = pack.tables[0].index;
    select.value = String(focusedTable);
    select.onchange = () => {
      focusedTable = Number(select.value);
      refresh();
    };
    table = pack.tables.find((value) => value.index === focusedTable);
  }
  if (!table) {
    e("p", "Waiting for your board to synchronize.");
    return;
  }
  const me = table.seats.find((seat) => seat.own),
    active = table.seats[table.turn];
  const controller = e("section");
  controller.className = "homeward-controller";
  controller.setAttribute(
    "aria-label",
    host ? "Board status" : "Your pawn controls",
  );
  controller.dataset.boardVersion = String(table.version);
  if (me)
    e(
      "p",
      `You are P${table.seats.indexOf(me) + 1}: ${HOMEWARD_COLORS[me.color].name}`,
      controller,
    ).className = "homeward-identity";
  if (table.result) {
    e(
      "h3",
      table.result.winner === null
        ? "Board settled"
        : `${table.seats[table.result.winner].name} brought all four Home!`,
      controller,
    );
    e("p", table.result.reason, controller);
    if (state.phase === "playing")
      e(
        "p",
        "Your board is finished. Other boards are still playing.",
        controller,
      );
    else
      e(
        "p",
        host
          ? "Review the scores, then choose Next to finish the match."
          : "The host will finish the match after reviewing the results.",
        controller,
      );
  } else {
    e("h3", `${active.name}'s turn`, controller);
    const clock = e("p", undefined, controller);
    clock.className = "homeward-turn-clock";
    clock.dataset.homewardTime = String(table.deadline);
    if (table.canDraw)
      b(
        "Draw a card",
        () =>
          play({
            action: "draw",
            table: table.index,
            tableVersion: table.version,
          }),
        controller,
      ).id = `homeward-draw-${table.index}`;
    const cardBox = e("div", undefined, controller);
    cardBox.className = "homeward-card-box";
    const face = e(
      "strong",
      table.card === "BUMP" ? "BUMP!" : (table.card ?? "?"),
      cardBox,
    );
    face.className = "homeward-card-face";
    face.dataset.card = table.card ?? "unknown";
    const explanation = e("div", undefined, cardBox);
    e(
      "h4",
      table.card
        ? HOMEWARD_CARDS[table.card].title
        : "Draw, then choose a move",
      explanation,
    );
    e(
      "p",
      table.card
        ? HOMEWARD_CARDS[table.card].help
        : "The deck stays hidden until a card is drawn.",
      explanation,
    );
    if (!table.canDraw && !table.canChoose)
      e(
        "p",
        host
          ? "Players act from their own phones. The server checks their moves."
          : "Wait for your turn. You can watch the board below.",
        controller,
      );
    if (table.canChoose)
      renderChoices(table, controller, { e, b, play, refresh, canAct });
  }
  const boardPanel = e(host ? "section" : "details");
  boardPanel.className = "homeward-board-panel";
  if (host) e("h3", `Board ${table.index + 1}`, boardPanel);
  else {
    e("summary", "View your board", boardPanel);
    remembered(
      boardPanel,
      `homeward-board:${state.matchId}:${table.index}:${state.phase}`,
      !!table.result,
    );
  }
  drawBoard(table, boardPanel, e);
  const roster = e("div", undefined, boardPanel);
  roster.className = "homeward-seats";
  table.seats.forEach((seat, index) => {
    const card = e("article", undefined, roster);
    card.dataset.color = String(seat.color);
    card.dataset.turn = String(!table.result && index === table.turn);
    card.dataset.own = String(seat.own);
    e("h4", `P${index + 1} · ${seat.name}`, card);
    e("p", HOMEWARD_COLORS[seat.color].name, card);
    e("strong", `${seat.homes}/4 Home`, card);
    e(
      "p",
      table.result
        ? `${table.result.points[index]} game points`
        : `${seat.pawns.filter((p) => p.zone === "safe").length} in the safe lane`,
      card,
    );
  });
  if (table.history.length) {
    const history = e("details");
    e("summary", "Recent cards & moves", history);
    remembered(history, `homeward-history:${state.matchId}:${table.index}`);
    const list = e("ol", undefined, history);
    list.className = "homeward-history";
    for (const event of [...table.history].reverse())
      e(
        "li",
        `${event.name}: ${event.card === null ? "" : event.card} · ${event.label}${event.bumps ? ` · ${event.bumps} bumped` : ""}${event.slides ? ` · ${event.slides} slide${event.slides === 1 ? "" : "s"}` : ""}`,
        list,
      );
  }
  if (host && pack.tables.length > 1) {
    const summary = e("details");
    e("summary", "All boards", summary);
    remembered(summary, `homeward-all-boards:${state.matchId}`);
    for (const board of pack.tables) {
      e(
        "p",
        `Board ${board.index + 1}: ${board.result ? board.result.reason : `${board.seats[board.turn].name}'s turn`}`,
        summary,
      );
      if (!board.result) {
        const clock = e("p", undefined, summary);
        clock.dataset.homewardTime = String(board.deadline);
      }
    }
  }
  const rules = e("details");
  e("summary", "How to play Sorry Ish", rules);
  remembered(rules, "homeward-help");
  e(
    "p",
    "Get all four pawns Home by exact count. One pawn starts out and three wait at Start. Draw and choose within one 30-second turn. The first four-pawn finish wins the board.",
    rules,
  );
  e(
    "p",
    "1 or 2 can launch a pawn; a 2 grants another card. A 4 moves backward. A 7 can divide seven steps between two pawns, in order. A 10 chooses ten forward or one back. An 11 advances or swaps two track pawns. Bump launches from Start onto an opponent on the track.",
    rules,
  );
  e(
    "p",
    "Landing on an opponent sends them to Start. Ordinary landings on your own pawn are blocked. Other colors' slides sweep every pawn on their path, including yours. Your own slides stay still. Safe lanes cannot be attacked; you can back out of your own lane. Home pawns never move again.",
    rules,
  );
  e(
    "p",
    "Use only the legal choices shown. A split uses all seven steps and cannot launch from Start. Swap only track pawns; only the acting pawn triggers a slide. Bump has no forward-four fallback. If an eleven has no forward move, its swap may be declined.",
    rules,
  );
  e(
    "p",
    "A timeout skips your move and burns any undrawn card, without an extra turn. Boards settle after 15 minutes or 600 cards. A winner gets 100 points; everyone else gets 20 per Home pawn and 5 per safe-lane pawn. An unfinished board has no winner and earns only progress points. Idle boards earn zero. Host-ended unfinished boards add no points.",
    rules,
  );
  e(
    "p",
    "This is an original 48-space house-rule game inspired by card-and-pawn races. Larger rooms use multiple boards of 2–4 players. The server preserves your board on reconnect; no account is needed.",
    rules,
  );
  tickHomewardClocks(state.serverNow);
}
function renderChoices(table, parent, { e, b, play, refresh, canAct }) {
  const moves = table.moves,
    key = `${match}:${table.version}`;
  let saved = choices.get(table.index);
  if (saved?.key !== key) {
    saved = { key };
    choices.set(table.index, saved);
  }
  const select = (labelText, id, values, value, onchange) => {
    const label = e("label", labelText, parent),
      field = e("select", undefined, parent);
    field.id = id;
    label.htmlFor = id;
    for (const [id, text] of values) {
      const option = e("option", text, field);
      option.value = String(id);
    }
    field.value = String(value);
    field.disabled = !canAct();
    field.onchange = () => {
      onchange(field.value);
      refresh();
    };
    return field;
  };
  if (moves.length) {
    const modes = [...new Set(moves.map(modeFor))];
    if (!modes.includes(saved.mode)) saved.mode = modes[0];
    if (modes.length > 1)
      select(
        "Move type",
        `homeward-mode-${table.index}`,
        modes.map((mode) => [mode, modeNames[mode]]),
        saved.mode,
        (value) => {
          saved.mode = value;
        },
      );
    else
      e("p", modeNames[saved.mode], parent).className = "homeward-choice-title";
    let filtered = moves.filter((move) => modeFor(move) === saved.mode);
    const eligible = [...new Set(filtered.map((move) => move.pawn))];
    if (!eligible.includes(saved.pawn)) saved.pawn = eligible[0];
    const pawns = e("div", undefined, parent);
    pawns.className = "homeward-pawn-choices";
    pawns.setAttribute("role", "group");
    pawns.setAttribute("aria-label", "Choose your first pawn");
    const me = table.seats[table.turn];
    me.pawns.forEach((pawn, index) => {
      const button = b(
        `Pawn ${letter(index)} · ${positionLabel(pawn)}`,
        () => {
          saved.pawn = index;
          refresh();
        },
        pawns,
        !eligible.includes(index) || !canAct(),
      );
      button.id = `homeward-pawn-${table.index}-${index}`;
      button.dataset.color = String(me.color);
      button.setAttribute("aria-pressed", String(saved.pawn === index));
    });
    filtered = filtered.filter((move) => move.pawn === saved.pawn);
    if (saved.mode === "split") {
      const amounts = [
        ...new Set(filtered.map((move) => move.firstSteps)),
      ].sort((a, b) => a - b);
      if (!amounts.includes(saved.amount)) saved.amount = amounts[0];
      select(
        "Steps for first pawn",
        `homeward-split-${table.index}`,
        amounts.map((n) => [
          n,
          `${n} ${n === 1 ? "step" : "steps"} first · ${7 - n} remaining`,
        ]),
        saved.amount,
        (value) => {
          saved.amount = Number(value);
        },
      );
      filtered = filtered.filter((move) => move.firstSteps === saved.amount);
      const second = [...new Set(filtered.map((move) => move.secondPawn))];
      if (!second.includes(saved.second)) saved.second = second[0];
      select(
        "Second pawn",
        `homeward-second-${table.index}`,
        second.map((index) => [
          index,
          `Pawn ${letter(index)} · ${positionLabel(me.pawns[index])}`,
        ]),
        saved.second,
        (value) => {
          saved.second = Number(value);
        },
      );
      filtered = filtered.filter((move) => move.secondPawn === saved.second);
    } else if (saved.mode === "swap" || saved.mode === "bump") {
      const targets = filtered.map((move) => [
        `${move.targetSeat}:${move.targetPawn}`,
        `P${move.targetSeat + 1} ${table.seats[move.targetSeat].name} · ${letter(move.targetPawn)} · ${positionLabel(table.seats[move.targetSeat].pawns[move.targetPawn])}`,
      ]);
      if (!targets.some(([key]) => key === saved.target))
        saved.target = targets[0][0];
      select(
        "Opponent's pawn",
        `homeward-target-${table.index}`,
        targets,
        saved.target,
        (value) => {
          saved.target = value;
        },
      );
      filtered = filtered.filter(
        (move) => `${move.targetSeat}:${move.targetPawn}` === saved.target,
      );
    }
    const selected = filtered[0];
    if (selected) {
      const preview = e(
        "p",
        selected.preview
          .map((p) => `${letter(p.pawn)} → ${positionLabel(p)}`)
          .join("; ") +
          (selected.bumps ? ` · ${selected.bumps} bumped` : "") +
          (selected.slides
            ? ` · ${selected.slides} slide${selected.slides === 1 ? "" : "s"}`
            : ""),
        parent,
      );
      preview.className = "homeward-preview";
      preview.setAttribute("role", "status");
      const text =
        selected.kind === "split"
          ? "Move both pawns"
          : selected.kind === "swap"
            ? "Swap pawns"
            : selected.kind === "bump"
              ? "Bump opponent"
              : `Move pawn ${letter(selected.pawn)}`;
      b(
        text,
        () => {
          if (canAct())
            play({
              action: "move",
              table: table.index,
              tableVersion: table.version,
              moveId: selected.id,
            });
        },
        parent,
        !canAct(),
      ).id = `homeward-confirm-${table.index}`;
    }
  } else
    e("p", "No legal move for this card. End this card's turn below.", parent);
  if (table.canPass)
    b(
      moves.length ? "Skip optional swap" : "No legal moves · end turn",
      () =>
        play({
          action: "pass",
          table: table.index,
          tableVersion: table.version,
        }),
      parent,
      !canAct(),
    );
}
