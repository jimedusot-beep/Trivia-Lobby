// SPDX-License-Identifier: AGPL-3.0-or-later
import { renderPoker } from "./poker-ui.js";
import { renderFeud } from "./feud-ui.js";
import { renderHomeward } from "./homeward-ui.js";
export { tickHomewardClocks } from "./homeward-ui.js";
import { renderDrawing, disposeDrawing } from "./drawing-ui.js";
export { drawingBusy } from "./drawing-ui.js";
const selections = new Map();
export function renderPack(state, context) {
  disposeDrawing();
  const { element: E, button: B, action, actor, refresh, canAct = () => true } = context,
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
  if(s.kind==="homeward") {
    renderHomeward(state,{root,e,b,play,refresh,canAct});
    return;
  }
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
  if (s.kind === "forbidden") {
    root.classList.add("forbidden-game");
    e("h2", "🗣️ Forbidden Word Frenzy");
    e("p", `Turn ${s.turn} of ${s.totalTurns} · 45 seconds · ${s.completed} of ${s.totalCards} cards judged`);
    e("p", `Clue giver: ${s.giver} · Referee: ${s.referee}`);
    if (playing) {
      if (s.card) {
        const secret = e("section");
        secret.className = "forbidden-secret";
        e("p", "Private phone card — do not show the audience!", secret);
        e("h3", s.card.word, secret);
        e("p", "Do NOT say these words:", secret);
        const words = e("ul", undefined, secret);
        for (const word of s.card.forbidden) e("li", word, words);
      } else if (!host) {
        e("p", "Guess out loud! The clue giver must avoid the forbidden words.");
      } else e("p", "Family members guess aloud. The referee privately marks correct, forbidden, or pass.");
      if (s.canJudge) {
        const controls=e("div");controls.className="forbidden-controls";
        b("Correct! +20 to clue giver",()=>play({action:"correct"}),controls);
        b("Forbidden word! −10",()=>play({action:"forbidden"}),controls);
        b("Pass this card",()=>play({action:"pass"}),controls);
      }
    } else {
      e("h3", "Turn results");
      const history=e("ol");
      for (const item of s.history ?? []) e("li", `${item.word}: ${item.result}`,history);
      if (!s.history?.length) e("p", "No words judged in this turn.");
    }
    return;
  }
  if (s.kind === "feud") {
    renderFeud(state,{root,e,b,play,input,canAct});
    return;
  }
  if (s.kind === "draw") {
    renderDrawing(state,{e,b,play,refresh,canAct,getPack:context.getPack ?? (()=>s)});
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
    seats.className = "color-seats";
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
      promotion.hidden = table.kind !== "chess" || !table.legal.some(m => m.promotion);
      if (!promotion.hidden) e("p", "Choose the piece for your pawn promotion.", box);
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
  if (s.kind === "table" && s.guided) {
    renderPoker(s,{e,b,play,host,playing,me,refresh,matchId:state.matchId});
  }
  if (s.kind === "table" && !s.guided) {
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
