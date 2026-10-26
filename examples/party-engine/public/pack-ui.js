// SPDX-License-Identifier: AGPL-3.0-or-later
const selections = new Map();
let drawing = false;
export const drawingBusy = () => drawing;
export function renderPack(state, context) {
  drawing = false;
  const { element: E, button: B, action, actor, refresh } = context,
    root = E("section");
  root.className = "open-game";
  const e = (tag, text, parent = root) => E(tag, text, parent),
    b = (text, fn, parent = root, disabled = false) =>
      B(text, fn, parent, disabled);
  const s = state.pack,
    host = state.role === "host",
    playing = state.phase === "playing",
    me = actor(),
    play = (value) => action("play", value);
  function input(label, id, max = 60, parent = root) {
    const wrap = e("div", undefined, parent),
      caption = e("label", label, wrap),
      field = e("input", undefined, wrap);
    field.id = id;
    field.maxLength = max;
    caption.htmlFor = id;
    field.autocomplete = "off";
    const key = `pack-draft:${state.matchId}:${state.index}:${id}`;
    try {
      field.value = sessionStorage.getItem(key) || "";
    } catch {}
    field.oninput = () => {
      try {
        sessionStorage.setItem(key, field.value);
      } catch {}
    };
    return field;
  }
  function entry(label, id, callback, parent = root) {
    const form = e("form", undefined, parent);
    form.className = "pack-entry";
    const field = input(label, id, 60, form),
      send = b("Submit", () => {}, form);
    send.type = "submit";
    form.onsubmit = (event) => {
      event.preventDefault();
      const value = field.value.trim();
      if (!value) return;
      field.value = "";
      try {
        sessionStorage.removeItem(
          `pack-draft:${state.matchId}:${state.index}:${id}`,
        );
      } catch {}
      callback(value);
    };
    return field;
  }
  if (s.kind === "feud") {
    e("h2", s.title);
    const teams = e("div");
    teams.className = "feud-teams";
    for (const team of s.teams) {
      const card = e("article", undefined, teams);
      e("h3", team.name, card);
      e("strong", `${team.score} points`, card);
      e("p", team.players.join(", "), card);
    }
    e("h3", s.question);
    if (!s.stage.startsWith("final")) {
      e(
        "p",
        `Board ${s.round} of ${s.total} · ×${s.multiplier} · Pot ${s.pot} · Strikes ${s.strikes} / 3`,
      );
      const board = e("ol");
      board.className = "feud-board";
      for (const answer of s.board)
        e(
          "li",
          answer.hidden
            ? `${answer.index + 1}. ?`
            : `${answer.text} — ${answer.points}`,
          board,
        );
      if (s.canBuzz && playing)
        b("BUZZ!", () => play({ action: "buzz" })).className = "buzz-button";
      if (s.buzzer)
        e("p", `${s.buzzer} buzzed first! Say your answer aloud to the host.`);
      if (s.team !== null && s.stage === "play")
        e(
          "p",
          `${s.teams[s.team].name} controls the board. Say your answers aloud.`,
        );
      if (s.stage === "steal")
        e("h3", `${s.teams[1 - s.team].name}: one answer to steal the pot!`);
      if (host && playing) {
        const controls = e("details");
        e("summary", "Private host controls", controls);
        e(
          "p",
          "Keep these answer controls off the shared screen. Judge the answers spoken by the teams.",
          controls,
        );
        try {
          controls.open =
            sessionStorage.getItem("feud-controls-open") === "yes";
        } catch {}
        controls.ontoggle = () => {
          try {
            sessionStorage.setItem(
              "feud-controls-open",
              controls.open ? "yes" : "no",
            );
          } catch {}
        };
        if (["faceoff", "play", "steal"].includes(s.stage)) {
          for (const a of s.judge)
            b(
              `Reveal ${a.text} (+${a.points})`,
              () => play({ action: "judge", index: a.index }),
              controls,
              !s.board[a.index].hidden,
            );
          b(
            s.stage === "faceoff"
              ? "Miss — other team takes control"
              : "Strike / missed steal",
            () => play({ action: "judge", index: -1 }),
            controls,
          );
          if (
            s.stage === "play" &&
            !s.strikes &&
            !s.passed &&
            s.board.filter((a) => !a.hidden).length === 1
          )
            b(
              "Pass control to the other team",
              () => play({ action: "pass" }),
              controls,
            );
        }
        for (let index = 0; index < 2; index++) {
          const field = input(
            `Team ${index + 1} name`,
            `feud-team-${index}`,
            24,
            controls,
          );
          b(
            "Save team name",
            () => play({ action: "team-name", index, name: field.value }),
            controls,
          );
        }
      }
    } else {
      e(
        "p",
        `Lightning final · Player ${s.finalPlayer} · ${s.finalist} · Question ${Math.min(s.finalCursor, 5)} / 5`,
      );
      if (s.stage === "final-ready") {
        e(
          "p",
          "Only the current finalist answers. Keep their phone private from the next finalist.",
        );
        if (host)
          b("Start lightning timer", () => play({ action: "final-start" }));
      }
      if (s.canAnswer) {
        entry("Your quick answer", "feud-final-answer", (text) =>
          play({ action: "final-answer", text }),
        );
        b("Pass this question", () => play({ action: "final-pass" }));
      }
      if (s.finalAnswers) {
        e(
          "h3",
          `${s.finalTotal} / ${s.goal} points${s.finalTotal >= s.goal ? " · Goal reached!" : ""}`,
        );
        s.questions.forEach((q, i) => {
          e("h4", q);
          for (let n = 0; n < 2; n++) {
            const a = s.finalAnswers[n][i];
            e("p", `Player ${n + 1}: ${a?.text ?? "Pass"} — ${a?.points ?? 0}`);
          }
        });
      }
    }
  }
  if (s.kind === "draw") {
    e("h2", `Doodle Dash · ${s.artistName}'s turn`);
    e("p", `Turn ${s.round} / ${s.total} · ${s.solved} correct guesses`);
    if (s.choices) {
      e("h3", "Choose your secret word");
      s.choices.forEach((word, index) =>
        b(word, () => play({ action: "choose", index })),
      );
    }
    if (s.word)
      e(
        "h3",
        `${state.phase === "reveal" ? "The word was" : "Your private word"}: ${s.word}`,
      );
    else if (s.hint) e("p", s.hint);
    const ns = "http://www.w3.org/2000/svg",
      svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 1000 1000");
    svg.setAttribute(
      "aria-label",
      s.canDraw
        ? "Drawing pad. Use pointer, or arrow keys to move and Enter to draw a line."
        : "Live drawing",
    );
    svg.setAttribute("role", "img");
    svg.classList.add("doodle-pad");
    root.append(svg);
    const line = (stroke) => {
      const path = document.createElementNS(ns, "polyline");
      path.setAttribute(
        "points",
        stroke.points.map((pt) => pt.join(",")).join(" "),
      );
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", stroke.color);
      path.setAttribute("stroke-width", String(stroke.width));
      path.setAttribute("stroke-linecap", "round");
      path.setAttribute("stroke-linejoin", "round");
      svg.append(path);
      return path;
    };
    for (const stroke of s.strokes) line(stroke);
    if (s.canDraw) {
      svg.tabIndex = 0;
      const tools = e("div");
      tools.className = "drawing-tools";
      const color = e("select", undefined, tools);
      color.setAttribute("aria-label", "Pen color");
      for (const [name, value] of [
        ["Ink", "#20264b"],
        ["Rose", "#e23867"],
        ["Blue", "#2477db"],
        ["Green", "#158346"],
        ["Gold", "#f0b83e"],
        ["Purple", "#9455cc"],
        ["Orange", "#ee7625"],
        ["Eraser", "#ffffff"],
      ]) {
        const o = e("option", name, color);
        o.value = value;
      }
      const width = e("select", undefined, tools);
      width.setAttribute("aria-label", "Pen width");
      for (const n of [4, 8, 16, 24]) {
        const o = e("option", `${n} px`, width);
        o.value = String(n);
      }
      width.value = "8";
      b("Undo stroke", () => play({ action: "undo" }), tools);
      b("Clear drawing", () => play({ action: "clear" }), tools);
      e("p", "Keyboard: arrows move the pen; Enter draws a short line.");
      let points = [],
        preview,
        startPoint = [500, 500],
        endPoint = [500, 500];
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
      svg.onpointerdown = (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        svg.setPointerCapture(event.pointerId);
        points = [position(event)];
        drawing = true;
        preview = line({
          points,
          color: color.value,
          width: Number(width.value),
        });
      };
      svg.onpointermove = (event) => {
        if (!drawing || !preview) return;
        const pt = position(event);
        if (Math.hypot(pt[0] - points.at(-1)[0], pt[1] - points.at(-1)[1]) < 5)
          return;
        points.push(pt);
        if (points.length > 64) points = points.filter((_, i) => i % 2 === 0);
        preview.setAttribute(
          "points",
          points.map((pt) => pt.join(",")).join(" "),
        );
      };
      svg.onpointerup = (event) => {
        if (!drawing) return;
        points.push(position(event));
        if (points.length > 64) points.splice(1, 1);
        if (points.length === 1) points.push([...points[0]]);
        drawing = false;
        play({
          action: "stroke",
          points,
          color: color.value,
          width: Number(width.value),
        });
      };
      svg.onpointercancel = () => {
        drawing = false;
        refresh();
      };
      svg.onkeydown = (event) => {
        const delta = {
          ArrowLeft: [-30, 0],
          ArrowRight: [30, 0],
          ArrowUp: [0, -30],
          ArrowDown: [0, 30],
        }[event.key];
        if (delta) {
          event.preventDefault();
          startPoint = [...endPoint];
          endPoint = [
            Math.max(0, Math.min(1000, endPoint[0] + delta[0])),
            Math.max(0, Math.min(1000, endPoint[1] + delta[1])),
          ];
        }
        if (event.key === "Enter") {
          event.preventDefault();
          play({
            action: "stroke",
            points: [startPoint, endPoint],
            color: color.value,
            width: Number(width.value),
          });
        }
      };
    }
    if (s.canGuess)
      entry("Guess the drawing", "drawing-guess", (text) =>
        play({ action: "guess", text }),
      );
    const guesses = e("ol");
    guesses.className = "drawing-guesses";
    for (const guess of s.guesses)
      e("li", `${guess.name}: ${guess.text}`, guesses);
  }
  if (s.kind === "colors") {
    e("h2", "Color Clash");
    e("p", s.note);
    e(
      "h3",
      `${s.turnName}'s turn · ${s.direction === 1 ? "Clockwise" : "Counterclockwise"}`,
    );
    e(
      "p",
      `Active color: ${s.color}${s.pending ? ` · Draw penalty: ${s.pending}` : ""}`,
    );
    const top = e("p", cardLabel(s.top));
    top.className = "color-card discard-card";
    top.dataset.color = s.top.color;
    const seats = e("ul");
    for (const seat of s.seats)
      e(
        "li",
        `${seat.name}: ${seat.count} card${seat.count === 1 ? " · ONE!" : "s"}`,
        seats,
      );
    if (s.spectating)
      e(
        "p",
        "You are watching this table. The first ten guests have active seats.",
      );
    if (s.hand.length) {
      const label = e("label", "Wild color");
      label.htmlFor = "wild-color";
      const select = e("select");
      select.id = "wild-color";
      for (const c of ["red", "blue", "green", "yellow"]) {
        const o = e("option", c, select);
        o.value = c;
      }
      const hand = e("div");
      hand.className = "card-hand";
      for (const card of s.hand) {
        const tile = b(
          cardLabel(card),
          () => play({ action: "play", card: card.id, color: select.value }),
          hand,
          !card.playable,
        );
        tile.className = "color-card";
        tile.dataset.color = card.color;
      }
      if (s.canPlay) {
        b(
          s.pending ? `Draw ${s.pending} and pass` : "Draw a card",
          () => play({ action: "draw" }),
          root,
          !!s.drawn,
        );
        if (s.drawn) b("Pass", () => play({ action: "pass" }));
      }
    }
  }
  if (s.kind === "boards") {
    e(
      "h2",
      `${state.mode === "four" ? "Four in a Row" : state.mode[0].toUpperCase() + state.mode.slice(1)} · paired tables`,
    );
    const own = s.tables.find((t) => t.own);
    const tables = own ? [own] : s.tables;
    if (own)
      e(
        "p",
        `You are at table ${own.index + 1}. Other pairs play at their own tables.`,
      );
    for (const table of tables) {
      const box = e("article");
      box.className = "board-table";
      e(
        "h3",
        `Table ${table.index + 1}: ${table.players.map((p) => p.name).join(" vs ")}`,
        box,
      );
      e(
        "p",
        table.result
          ? table.result.draw
            ? "Draw"
            : `${table.players[table.result.winner].name} wins!`
          : `${table.players[table.turn].name}'s turn${table.check ? " · Check!" : ""}`,
        box,
      );
      const key = `${state.matchId}:${table.index}`,
        selected = selections.get(key),
        promotion = e("select", undefined, box);
      promotion.setAttribute(
        "aria-label",
        `Promotion for table ${table.index + 1}`,
      );
      for (const [value, name] of [
        ["q", "Queen"],
        ["r", "Rook"],
        ["b", "Bishop"],
        ["n", "Knight"],
      ]) {
        const o = e("option", name, promotion);
        o.value = value;
      }
      promotion.hidden = table.kind !== "chess";
      const move = (to) => {
        const request = { action: "move", table: table.index, to };
        if (table.kind === "chess" || table.kind === "checkers") {
          if (!table.legal.some((m) => m.from === selected && m.to === to)) {
            selections.set(key, to);
            refresh();
            return;
          }
          request.from = selected;
          if (table.kind === "chess") request.promotion = promotion.value;
        }
        selections.delete(key);
        play(request);
      };
      const grid = e("div", undefined, box);
      grid.className = `board-grid board-${table.kind}`;
      if (table.kind === "four") {
        for (let i = 0; i < 7; i++)
          b(
            `Drop ${i + 1}`,
            () => move(i),
            grid,
            !table.canMove || !table.legal.some((m) => m.to === i),
          );
        for (const value of table.cells) {
          const cell = e(
            "span",
            value === null ? "·" : value === 0 ? "●" : "○",
            grid,
          );
          cell.className = "four-cell";
          cell.setAttribute(
            "aria-label",
            value === null
              ? "Empty"
              : value === 0
                ? "First player disc"
                : "Second player disc",
          );
        }
      } else if (table.kind === "mancala") {
        for (const i of [13, 12, 11, 10, 9, 8, 7, 0, 1, 2, 3, 4, 5, 6])
          b(
            `${i === 6 || i === 13 ? "Store" : "Pit"} ${i + 1}: ${table.cells[i]}`,
            () => move(i),
            grid,
            !table.canMove || !table.legal.some((m) => m.to === i),
          );
      } else {
        for (let i = 0; i < 64; i++) {
          const value = table.cells[i],
            text =
              table.kind === "chess"
                ? (chessPieces[value] ?? "")
                : table.kind === "reversi"
                  ? value === null
                    ? ""
                    : value === 0
                      ? "●"
                      : "○"
                  : value === null
                    ? ""
                    : Math.abs(value) === 2
                      ? value > 0
                        ? "♔"
                        : "♚"
                      : value > 0
                        ? "●"
                        : "○";
          const tile = b(text || " ", () => move(i), grid, !table.canMove);
          tile.className = "board-cell";
          tile.dataset.dark = String(((i % 8) + Math.floor(i / 8)) % 2 === 1);
          tile.dataset.selected = String(selected === i);
          tile.dataset.legal = String(
            table.legal.some(
              (m) =>
                m.to === i &&
                (selected === undefined ||
                  m.from === undefined ||
                  m.from === selected),
            ),
          );
          tile.setAttribute(
            "aria-label",
            `${"abcdefgh"[i % 8]}${8 - Math.floor(i / 8)} ${pieceName(table.kind, value)}`,
          );
          tile.dataset.square = String(i);
        }
        grid.onkeydown = (event) => {
          const delta = {
            ArrowLeft: -1,
            ArrowRight: 1,
            ArrowUp: -8,
            ArrowDown: 8,
          }[event.key];
          if (delta === undefined) return;
          const index = Number(document.activeElement?.dataset.square);
          const target = grid.querySelector(`[data-square="${index + delta}"]`);
          if (target) {
            event.preventDefault();
            target.focus();
          }
        };
      }
      if (table.canMove)
        b(
          "Resign this table",
          () => {
            if (confirm("Resign this table and give your opponent the win?"))
              play({ action: "resign", table: table.index });
          },
          box,
        );
    }
  }
  if (s.kind === "table") {
    e(
      "h2",
      `${s.preset === "whist" ? "Whist" : "Poker"} table · Hand ${s.handNumber}`,
    );
    e("p", s.note);
    e(
      "p",
      `Pot: ${s.pot} play chips · Deck: ${s.deckCount} cards · Dice: ${s.dice.join(" + ") || "not rolled"}`,
    );
    e("p", "Your group manages the game rules. Play chips have no cash value.");
    for (const seat of s.seats) {
      e("h3", `${seat.name} · ${seat.count} cards · ${seat.chips} chips`);
      if (seat.cards) e("p", seat.cards.map(standardCard).join(" · "));
    }
    e("h3", "Cards on the table");
    const table = e("div");
    table.className = "card-hand";
    for (const card of s.center) {
      const tile = b(
        `${standardCard(card)} · ${card.ownerName}`,
        () => play({ action: "take-back", card: card.id }),
        table,
        !s.active || card.owner !== me,
      );
      tile.className = "standard-card";
    }
    if (s.active) {
      e("h3", "Your private hand");
      const hand = e("div");
      hand.className = "card-hand";
      for (const card of s.hand) {
        const tile = b(
          standardCard(card),
          () => play({ action: "play", card: card.id }),
          hand,
        );
        tile.className = "standard-card";
      }
      b("Reveal my hand to everyone", () => play({ action: "reveal-hand" }));
      b("Roll two dice", () => play({ action: "roll" }));
      const amount = input("Play chips to add to pot", "chip-bet", 3);
      amount.type = "number";
      amount.min = "1";
      amount.max = "999";
      b("Add chips to pot", () =>
        play({ action: "bet", amount: Number(amount.value) }),
      );
    } else if (!host)
      e(
        "p",
        "You are watching this table. Active seats were assigned when the host started.",
      );
    if (host && playing) {
      b("Shuffle and deal a new hand", () => play({ action: "deal" }));
      const winner = e("select");
      winner.setAttribute("aria-label", "Player to receive pot");
      for (const seat of s.seats) {
        const o = e("option", seat.name, winner);
        o.value = String(seat.index);
      }
      b("Award pot to selected player", () =>
        play({ action: "settle", seat: Number(winner.value) }),
      );
      b("Finish table", () => play({ action: "finish" }));
    }
  }
  if (s.kind === "backgammon") {
    e("h2", "Backgammon table");
    e("p", s.note);
    e("h3", `${s.seats[s.turn].name}'s turn`);
    e("p", `Dice: ${s.dice.join(" + ") || "roll to start"}`);
    const key = `${state.matchId}:backgammon`,
      selected = selections.get(key);
    const grid = e("div");
    grid.className = "backgammon-points";
    const move = (i) => {
      if (selected !== undefined) {
        selections.delete(key);
        play({ action: "move", from: selected, to: i });
      } else {
        selections.set(key, i);
        refresh();
      }
    };
    for (const i of [
      ...Array.from({ length: 12 }, (_, n) => 23 - n),
      ...Array.from({ length: 12 }, (_, n) => n),
    ]) {
      const tile = b(
        `${i + 1}: ${s.points[i] > 0 ? "●" : s.points[i] < 0 ? "○" : "·"} ${Math.abs(s.points[i]) || ""}`,
        () => move(i),
        grid,
        !s.canMove || !s.dice.length,
      );
      tile.dataset.selected = String(selected === i);
    }
    e(
      "p",
      `Bar: ${s.bar[0]} / ${s.bar[1]} · Borne off: ${s.off[0]} / ${s.off[1]}`,
    );
    if (s.canMove) {
      b("Roll dice", () => play({ action: "roll" }), root, !!s.dice.length);
      b(
        "Choose checker on my bar",
        () => {
          selections.set(key, 24);
          refresh();
        },
        root,
        !s.dice.length || !s.bar[s.turn],
      );
      b(
        "Bear selected checker off",
        () => move(25),
        root,
        selected === undefined,
      );
      b("Cancel selection", () => {
        selections.delete(key);
        refresh();
      });
      b("End turn", () => play({ action: "end-turn" }), root, !s.dice.length);
    }
  }
}
function cardLabel(card) {
  return `${card.color} ${card.value.replaceAll("_", " ")}`;
}
const standardCard = (card) => `${card.rank}${card.suit}`;
const chessPieces = {
  wp: "♙",
  wn: "♘",
  wb: "♗",
  wr: "♖",
  wq: "♕",
  wk: "♔",
  bp: "♟",
  bn: "♞",
  bb: "♝",
  br: "♜",
  bq: "♛",
  bk: "♚",
};
function pieceName(kind, value) {
  if (value === null) return "empty";
  if (kind === "chess")
    return `${value[0] === "w" ? "white" : "black"} ${{ p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" }[value[1]]}`;
  return `${kind === "checkers" ? (value > 0 ? "white" : "black") : value === 0 ? "black" : "white"} ${kind === "checkers" && Math.abs(value) === 2 ? "king" : "disc"}`;
}
