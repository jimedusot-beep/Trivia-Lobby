// SPDX-License-Identifier: AGPL-3.0-or-later
const selectedHands = new Map();
const suits = {
  "♠": "spades",
  "♥": "hearts",
  "♦": "diamonds",
  "♣": "clubs",
};
const ranks = { A: "Ace", K: "King", Q: "Queen", J: "Jack" };
const cardName = (c) => `${ranks[c.rank] ?? c.rank} of ${suits[c.suit]}`;
export function renderPoker(
  s,
  { e, b, play, host, playing, me, refresh, matchId },
) {
  const title = e(
    "h2",
    `Five-card Draw · Hand ${s.handNumber} of ${s.totalHands}`,
  );
  title.parentElement.classList.add("poker-game");
  e(
    "p",
    "Play chips only · 5-chip ante · 10-chip bet increases · up to three replacements",
  );
  const pot = e(
    "p",
    `Pot: ${s.pot} play chips${s.lastPot ? ` · Last pot: ${s.lastPot}` : ""}`,
  );
  pot.className = "poker-pot";
  const stage = {
    bet1: "First betting round",
    draw: "Replace cards",
    bet2: "Final betting round",
    showdown: "Hand results",
    complete: "Match results",
  }[s.stage];
  e("h3", `${stage}${s.turnName ? ` · ${s.turnName}'s turn` : ""}`);
  const note = e("p", s.note);
  note.setAttribute("role", "status");
  const table = e("div");
  table.className = "poker-table";
  for (const seat of s.seats) {
    const box = e("article", undefined, table);
    box.className = "poker-seat";
    box.dataset.turn = String(seat.id === s.turn);
    e(
      "h4",
      `${seat.name}${seat.id === me ? " (you)" : ""}${seat.dealer ? " · Dealer" : ""}`,
      box,
    );
    e("strong", `${seat.chips} chips`, box);
    e(
      "p",
      `Contributed ${seat.contribution}${seat.folded ? " · Folded" : seat.allIn ? " · All-in" : !seat.inHand ? " · Out of chips" : ""}`,
      box,
    );
    if (seat.drawn !== undefined) e("p", `Replaced ${seat.drawn} cards`, box);
    if (seat.payout) e("p", `Received ${seat.payout} chips`, box);
    if (seat.cards) {
      e("p", seat.handName, box);
      const cards = e("div", undefined, box);
      cards.className = "poker-revealed";
      for (const card of seat.cards) {
        const c = e("span", `${card.rank}${card.suit}`, cards);
        c.className = "poker-card";
        c.dataset.red = String(["♥", "♦"].includes(card.suit));
        c.setAttribute("aria-label", cardName(card));
      }
    }
  }
  let tablePanel = table;
  if (!host) {
    tablePanel = e("details");
    tablePanel.className = "poker-table-details";
    e("summary", "Players, chips and table results", tablePanel);
    tablePanel.append(table);
    const key = `poker-table-open:${matchId}:${s.handNumber}`;
    let saved = null;
    try {
      saved = sessionStorage.getItem(key);
    } catch {}
    tablePanel.open =
      saved === null
        ? ["showdown", "complete"].includes(s.stage)
        : saved === "yes";
    tablePanel.ontoggle = () => {
      try {
        sessionStorage.setItem(key, tablePanel.open ? "yes" : "no");
      } catch {}
    };
  }
  if (s.pots.length) {
    const results = e("ul");
    results.className = "poker-payouts";
    s.pots.forEach((pot, index) =>
      e(
        "li",
        `${pot.refund ? "Uncalled chips returned" : index === 0 ? "Main pot" : `Side pot ${index}`}: ${pot.amount} chips → ${pot.winners.join(", ")}`,
        results,
      ),
    );
  }
  if (!host && !s.active)
    e(
      "p",
      s.seats.some((seat) => seat.id === me)
        ? "You are out of chips and watching the remaining hands."
        : "You are watching. The first six guests have poker seats; Whist has four seats.",
    );
  const controller = e("section");
  controller.className = "poker-controller";
  if (s.hand.length) {
    const settled = ["showdown", "complete"].includes(s.stage);
    e("h3", settled ? "Your hand" : "Your private hand", controller);
    e(
      "p",
      `Your hand: ${s.handName}.${settled ? " This hand is settled." : " Keep your phone private."}`,
      controller,
    );
    const hand = e("div", undefined, controller);
    hand.className = "card-hand poker-hand";
    const key = `${matchId}:${s.handNumber}:${me}`;
    let selected = selectedHands.get(key) ?? new Set();
    if (!s.canDraw) {
      selected = new Set();
      selectedHands.delete(key);
    }
    for (const card of s.hand) {
      const c = s.canDraw
        ? b(
            `${card.rank}${card.suit}`,
            () => {
              if (selected.has(card.id)) selected.delete(card.id);
              else if (selected.size < 3) selected.add(card.id);
              selectedHands.set(key, selected);
              refresh();
            },
            hand,
            selected.size === 3 && !selected.has(card.id),
          )
        : e("span", `${card.rank}${card.suit}`, hand);
      c.className = "poker-card standard-card";
      c.dataset.red = String(["♥", "♦"].includes(card.suit));
      c.dataset.selected = String(selected.has(card.id));
      c.setAttribute("aria-label", cardName(card));
      if (s.canDraw)
        c.setAttribute("aria-pressed", String(selected.has(card.id)));
    }
    if (s.canDraw) {
      e(
        "p",
        `Select up to three cards to replace. ${selected.size} selected. Leave all unselected to stand pat.`,
        controller,
      );
      b(
        selected.size
          ? `Replace ${selected.size} selected cards`
          : "Stand pat (keep all 5)",
        () => {
          const cards = [...selected];
          selectedHands.delete(key);
          play({ action: "discard", cards });
        },
        controller,
      );
    }
  }
  const controls = e("div", undefined, controller);
  controls.className = "poker-actions";
  if (playing && s.actions.fold) {
    e(
      "p",
      "Your turn. Checking costs nothing; calling matches the current bet. Folding gives up this hand.",
      controls,
    );
    if (s.actions.check) b("Check", () => play({ action: "check" }), controls);
    if (s.actions.call)
      b(
        `Call ${s.actions.call} chips`,
        () => play({ action: "call" }),
        controls,
      );
    if (s.actions.raise)
      b(
        `${s.currentBet ? "Raise" : "Bet"} · add ${s.actions.raise} chips`,
        () => play({ action: "bet" }),
        controls,
      );
    b("Fold", () => play({ action: "fold" }), controls);
  } else if (s.turnName && !host && !s.canDraw)
    e(
      "p",
      `Waiting for ${s.turnName}. Each turn allows 45 seconds.`,
      controller,
    );
  if (s.canDeal) {
    b("Next poker hand", () => play({ action: "deal" }), controls);
    b("Finish poker match", () => play({ action: "finish" }), controls);
  }
  if (!host) tablePanel.before(controller);
  const help = e("details");
  e("summary", "How to play five-card draw", help);
  const steps = e("ol", undefined, help);
  for (const text of [
    "Each seated player starts with 200 play chips. Every hand antes up to 5 chips and deals five private cards. The dealer rotates each hand.",
    "Bet clockwise: check for free, bet or raise in 10-chip increments, call to match, or fold. Each betting round allows four full increases (an opening bet plus three raises). Short stacks can go all-in without reopening an earlier player's raise.",
    "Take turns replacing zero to three cards once. Then complete a final betting round. This is draw poker: there are no shared community cards or dice.",
    "The server compares the remaining hands, splits tied pots and handles all-in side pots. Odd chips go clockwise after the dealer. Folded hands stay private. A lone unmatched contribution is returned.",
    "After each result the host deals again or finishes. Five hands or one remaining funded seat ends the match; the chip leader earns 100 game points, with ties sharing that reward.",
    "A missed turn checks if possible or folds when facing a bet. A missed card-exchange turn keeps all five cards.",
  ])
    e("li", text, steps);
  e(
    "p",
    "Strongest to weakest: straight flush, four of a kind, full house, flush, straight, three of a kind, two pair, one pair, high card. An ace can be low in A–2–3–4–5.",
    help,
  );
}
