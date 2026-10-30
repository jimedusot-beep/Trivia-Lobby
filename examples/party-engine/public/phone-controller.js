// Original presentation adapter. Server projections and action contracts are unchanged.
let active;
const remembered = new Map();
const byId = (id) => document.getElementById(id);
function make(tag, text, parent, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  parent?.append(node);
  return node;
}
function control(label, callback, parent) {
  const button = make("button", label, parent);
  button.type = "button";
  button.addEventListener("click", callback);
  return button;
}
export function disposePhoneController() {
  if (!active) return;
  active.cleanup();
  active = undefined;
  document.body.classList.remove("phone-controller-active");
  delete document.body.dataset.controllerMode;
  document.documentElement.style.removeProperty("--controller-height");
  document.documentElement.style.removeProperty("--controller-top");
  document.documentElement.style.removeProperty("--controller-status-height");
}
function titleFor(state) {
  return (
    state.question?.prompt ??
    state.social?.prompt ??
    state.bonus?.prompt ??
    state.prompt ??
    state.charades?.clue?.text ??
    state.pack?.question ??
    ""
  );
}
export function mountPhoneController(state, { actor, game, releaseControls }) {
  disposePhoneController();
  if (state.role === "host") return;
  const content = byId("content"),
    old = [...content.childNodes],
    key = `${state.matchId}:${state.mode}:${state.phase}:${state.index}:${state.pack?.stage ?? ""}`;
  let saved = remembered.get(key) ?? { page: 0, dialog: "" };
  remembered.set(key, saved);
  if (remembered.size > 40) remembered.delete(remembered.keys().next().value);
  document.body.classList.add("phone-controller-active");
  document.body.dataset.controllerMode = state.mode;
  const shell = make("section", undefined, content, "phone-shell");
  shell.setAttribute("aria-label", `${game?.name ?? "Party"} controller`);
  const hud = make("div", undefined, shell, "phone-hud");
  const own = state.players.find((p) => p.id === actor);
  make("strong", game?.name ?? "Party", hud, "phone-game-name");
  const identity = make("span", own?.name ?? "Guest", hud, "phone-identity");
  identity.title = `${own?.name ?? "Guest"} · Room ${state.code}`;
  const timer = make("span", "", hud, "phone-clock");
  timer.setAttribute("aria-live", "off");
  const prompt = titleFor(state);
  if (prompt) {
    const title = control(prompt, (event) => open("info", event.currentTarget), shell);
    title.id = "phone-prompt";
    title.className = "phone-prompt";
    title.setAttribute("aria-label", `Read full prompt: ${prompt}`);
    title.title = "Read the complete prompt and game information";
  }
  const stage = make("div", undefined, shell, "phone-stage");
  shell.dataset.board = String(
    state.pack?.kind === "boards" || state.mode === "bingo",
  );
  const surface = make("div", undefined, stage, "phone-surface open-game");
  const pager = make("nav", undefined, shell, "phone-pager");
  pager.setAttribute("aria-label", "Controller pages");
  const previous = control(
      "← Previous",
      () => show(saved.page - 1, true),
      pager,
    ),
    pageLabel = make("span", "", pager),
    next = control("Next →", () => show(saved.page + 1, true), pager);
  pageLabel.setAttribute("aria-live", "polite");
  const footer = make("nav", undefined, shell, "phone-menu");
  footer.setAttribute("aria-label", "Controller menu");
  const menuButtons = {};
  for (const [name, label] of [
    ["info", "Game info"],
    ["scores", "Scores"],
    ["options", "Options"],
  ]) {
    menuButtons[name] = control(label, (event) => open(name, event.currentTarget), footer);
    // app.js restores focus by ID after an authoritative state broadcast.
    menuButtons[name].id = `phone-menu-${name}`;
  }
  const dialog = make("dialog", undefined, content, "phone-dialog");
  const dialogBar = make("div", undefined, dialog, "phone-dialog-bar"),
    dialogTitle = make("h2", "", dialogBar);
  dialogTitle.id = "phone-dialog-title";
  dialog.setAttribute("aria-labelledby", dialogTitle.id);
  const close = control("Back to game", () => dialog.close(), dialogBar);
  close.id = "phone-dialog-close";
  const dialogFeedback = make(
    "p",
    byId("status").textContent,
    dialog,
    "phone-dialog-feedback",
  );
  dialogFeedback.setAttribute("role", "status");
  const panels = {};
  for (const name of ["info", "scores", "options"]) {
    panels[name] = make("div", undefined, dialog, "phone-dialog-body");
    panels[name].id = `phone-panel-${name}`;
    panels[name].tabIndex = 0;
  }
  const fullPrompt = make(
    "h3",
    prompt || game?.name || "Game information",
    panels.info,
  );
  fullPrompt.className = "phone-full-prompt";
  if (game?.rules) make("p", game.rules, panels.info);
  for (const assignment of state.assignments ?? [])
    make("h3", assignment.prompt, panels.info);
  const originals = make("div", undefined, panels.info, "phone-originals");
  originals.append(...old);
  const gameRoot = originals.querySelector(".open-game");
  if (gameRoot) surface.classList.add(...gameRoot.classList);
  const take = (selector, parent = originals) => [
    ...parent.querySelectorAll(selector),
  ];
  const direct = gameRoot ? [...gameRoot.children] : [...originals.children];
  const blocks = [];
  function add(node) {
    if (!node || blocks.includes(node)) return;
    blocks.push(node);
    surface.append(node);
  }
  function choices(nodes, className = "phone-choices") {
    if (!nodes.length) return null;
    const group = make("div", undefined, undefined, className);
    group.append(...nodes);
    add(group);
    return group;
  }
  const settled = ["reveal", "finished"].includes(state.phase);
  if (settled) {
    const result = make("div", undefined, undefined, "phone-result");
    make(
      "h2",
      state.phase === "finished" ? "Match complete" : "Round complete",
      result,
    );
    make("strong", `${own?.score ?? 0} points`, result);
    if (state.question?.correct !== undefined)
      make(
        "p",
        `Correct: ${state.question.choices[state.question.correct]}`,
        result,
      );
    if (state.pack?.kind === "draw" && state.pack.word)
      make("p", `The word was: ${state.pack.word}`, result);
    make("p", "Watch the shared screen. Your host will continue.", result);
    const details = control("See round details", (event) => open("info", event.currentTarget), result);
    details.id = "phone-round-details";
    add(result);
  } else if (state.pack?.kind === "draw") {
    const board = originals.querySelector(".doodle-pad");
    const workspace = make("div", undefined, undefined, "phone-drawing");
    if (state.pack.word)
      make("strong", `Private word: ${state.pack.word}`, workspace);
    else if (state.pack.hasGuessed)
      make("strong", "You guessed it! Your points are locked.", workspace);
    else if (state.pack.hint)
      make("strong", `Word pattern: ${state.pack.hint}`, workspace);
    if (state.pack.choices) {
      add(make("h3", "Choose your secret word"));
      choices(direct.filter((n) => n.matches("button")));
    }
    if (board) workspace.append(board.parentElement);
    const tools = make("div", undefined, workspace, "phone-drawing-actions");
    for (const button of take(".drawing-tools button"))
      if (/^(Undo|Redo)/.test(button.textContent)) tools.append(button);
    if (state.pack.canDraw) {
      const penTools = control(
        "Pen tools",
        (event) => {
          open("info", event.currentTarget);
          originals.querySelector(".drawing-tools select")?.focus();
        },
        tools,
      );
      penTools.id = "phone-pen-tools";
    }
    const form = originals.querySelector(".pack-entry");
    if (form) workspace.append(form);
    if (state.pack.stage !== "choose") add(workspace);
  } else if (state.pack?.kind === "race") {
    const assist = originals.querySelector(".race-assist");
    if (assist) panels.options.append(assist);
    for (const node of take(".race-keyboard-hint,.race-look-up,.race-options"))
      originals.append(node);
    add(originals.querySelector(".race-game"));
  } else if (state.pack?.kind === "tap") {
    add(originals.querySelector(".tap-panel"));
  } else if (state.pack?.kind === "trails") {
    for (const selector of [
      ".trails-clock",
      ".trails-status",
      ".trails-controls",
    ])
      add(originals.querySelector(selector));
  } else if (state.race) {
    add(originals.querySelector(".arcade-race-controls"));
  } else if (state.pack?.kind === "feud") {
    add(originals.querySelector(".feud-controller"));
  } else if (state.pack?.kind === "homeward") {
    const source = originals.querySelector(".homeward-controller"),
      chrome = make("div", undefined, undefined, "phone-homeward-context"),
      setup = make("div", undefined, undefined, "phone-homeward-setup"),
      finish = make("div", undefined, undefined, "phone-homeward-finish");
    surface.classList.add("homeward-controller");
    surface.dataset.boardVersion = source.dataset.boardVersion;
    const identity = source.querySelector(".homeward-identity"),
      turn = source.querySelector("h3");
    make(
      "p",
      `${identity?.textContent ?? "Your board"} · ${turn?.textContent ?? ""}`,
      chrome,
    );
    if (identity) originals.append(identity);
    if (turn) originals.append(turn);
    for (const child of [...source.children]) {
      if (child.matches(".homeward-turn-clock,.homeward-card-box")) {
        if (child.matches(".homeward-card-box")) {
          const explanation = child.querySelector("div > p");
          if (explanation) originals.append(explanation);
        }
        chrome.append(child);
      } else if (child.matches("label")) {
        const field = byId(child.htmlFor),
          target = child.htmlFor.startsWith("homeward-mode-") ? setup : finish,
          pair = make("div", undefined, target, "phone-homeward-field");
        pair.append(child);
        if (field) pair.append(field);
      } else if (child.parentElement !== source) continue;
      else if (
        child.matches(".homeward-preview") ||
        child.id.startsWith("homeward-confirm-") ||
        /^(Skip optional|No legal moves)/.test(child.textContent)
      )
        finish.append(child);
      else setup.append(child);
    }
    source.remove();
    chrome.dataset.pinned = "yes";
    add(chrome);
    if (setup.children.length) add(setup);
    if (finish.children.length) add(finish);
  } else if (state.pack?.kind === "table" && state.pack.guided) {
    const controller = originals.querySelector(".poker-controller");
    const meta = make(
      "p",
      `Pot: ${state.pack.pot} · ${gameRoot?.querySelector(":scope > h3")?.textContent ?? ""} · ${state.pack.handName ?? ""}`,
      undefined,
      "phone-poker-meta",
    );
    controller.prepend(meta);
    add(controller);
  } else if (state.pack?.kind === "boards") {
    for (const table of take(".board-table")) {
      const resign = [...table.querySelectorAll("button")].find(
        (b) => b.textContent === "Resign this table",
      );
      if (resign) originals.append(resign);
      add(table);
    }
  } else if (state.pack?.kind === "colors") {
    const context = make("div", undefined, undefined, "phone-card-context");
    make(
      "p",
      `${state.pack.canPlay ? "Your turn" : "Waiting"} · ${originals.querySelector(".discard-card")?.textContent ?? state.pack.color} · Active ${state.pack.color}${state.pack.pending ? ` · Draw ${state.pack.pending}` : ""}`,
      context,
    );
    for (const node of direct.filter((n) => n.matches("label,select")))
      context.append(node);
    context.dataset.pinned = "yes";
    add(context);
    const hand = originals.querySelector(".card-hand");
    if (hand) add(hand);
    const actions = choices(direct.filter((n) => n.matches("button")));
    if (actions) actions.dataset.pinned = "yes";
  } else if (state.pack?.kind === "backgammon") {
    const dice = make(
      "p",
      `Dice: ${state.pack.dice.join(" + ") || "roll to start"} · Bar ${state.pack.bar.join(" / ")}`,
      undefined,
      "phone-board-note",
    );
    dice.dataset.pinned = "yes";
    add(dice);
    add(originals.querySelector(".backgammon-points"));
    const actions = choices(
      direct.filter(
        (n) =>
          n.matches("button") && /^(Roll dice|End turn)$/.test(n.textContent),
      ),
    );
    if (actions) actions.dataset.pinned = "yes";
  } else if (state.pack?.kind === "forbidden") {
    add(originals.querySelector(".forbidden-secret"));
    add(originals.querySelector(".forbidden-controls"));
  } else if (state.pack?.kind === "table") {
    for (const hand of take(".card-hand")) add(hand);
    // Optional manual table operations remain in Game info, with their original
    // input/action closures. The hand is the focused controller surface.
  } else if (state.mode === "duel" && state.phase === "writing") {
    for (const assignment of take("article")) {
      if (!assignment.querySelector("textarea")) continue;
      assignment.dataset.singlePage = "yes";
      add(assignment);
    }
  } else {
    if (state.social?.kind === "impostor" && state.phase === "clue") {
      const role = make(
        "strong",
        state.social.role === "impostor"
          ? "You are the impostor. Blend in!"
          : `Secret word: ${state.social.secretWord}`,
      );
      role.dataset.pinned = "yes";
      add(role);
    }
    for (const selector of [
      ".social-entry",
      ".timeline-list",
      ".family-bingo-board",
    ])
      for (const node of take(selector)) add(node);
    if (state.charades?.canMark) add(originals.querySelector("#current-clue"));
    const buttons = direct.filter((n) => n.matches("button"));
    // Social renderers emit one button per candidate, in projection order.
    // Player identity keeps focus stable across broadcasts without depending
    // on nickname text. Preserve IDs supplied by the native renderer.
    const candidates = state.social?.candidates;
    if (candidates?.length === buttons.length)
      buttons.forEach((button, index) => {
        if (!button.id) button.id = `phone-candidate-${candidates[index].id}`;
      });
    choices(buttons);
  }
  // A waiting player gets useful feedback, not a blank panel. Full state remains
  // in Game info; this only reads the calling player's authorized projection.
  if (!blocks.length) {
    const note = make("div", undefined, undefined, "phone-wait");
    const text = [...originals.querySelectorAll("p")]
      .map((p) => p.textContent)
      .find((t) => /waiting|locked|guess|host|choosing|watch/i.test(t));
    make("h2", state.phase === "lobby" ? "You're in!" : "Stay ready", note);
    make(
      "p",
      text || "Watch the shared screen. Your next controls appear here.",
      note,
    );
    add(note);
  }
  if (state.locked || state.social?.locked || state.bonus?.locked) {
    const locked = make("p", "Locked · waiting for the others.");
    locked.dataset.pinned = "yes";
    add(locked);
  }
  const scores = panels.scores;
  make("h3", "This game", scores);
  const list = make("ol", undefined, scores);
  for (const p of state.players)
    make(
      "li",
      `${p.name}: ${p.score} points${p.connected ? "" : " · offline"}`,
      list,
    );
  if (state.championship?.standings?.length) {
    make("h3", "Game Night Championship", scores);
    const standings = make("ol", undefined, scores);
    for (const p of state.championship.standings)
      make("li", `${p.name}: ${p.points} points · ${p.wins} wins`, standings);
  }
  make("h3", `Room ${state.code}`, panels.options);
  make(
    "p",
    `Playing as ${own?.name ?? "Guest"}. Keep this tab to retain your reconnect credential.`,
    panels.options,
  );
  const credits = make(
    "a",
    "Game credits, licenses & source code",
    panels.options,
  );
  credits.href = new URL("./sources.html", location.href).href;
  credits.id = "phone-credits";
  const leave = control(
    "Leave party",
    () => {
      if (confirm("Leave this party on this device?")) byId("leave").click();
    },
    panels.options,
  );
  leave.id = "phone-leave";
  let pages = [],
    pageAnchor,
    destroyed = false,
    requested;
  const choiceGroups = [
    ...surface.querySelectorAll(".phone-choices,.card-hand:not(.poker-hand),.backgammon-points"),
  ].map((root) => ({
    root,
    children: [...root.children],
    parts: [root],
    count: 0,
  }));
  function open(name, opener) {
    releaseControls?.();
    // Keep a stable identity across authoritative remounts. Pointer activation
    // does not focus buttons in every browser, so use the actual event target.
    if (opener) saved.returnFocusId = opener.id;
    saved.dialog = name;
    for (const [key, panel] of Object.entries(panels))
      panel.hidden = key !== name;
    dialogTitle.textContent = {
      info: "Game information",
      scores: "Scores",
      options: "Controller options",
    }[name];
    if (!dialog.open) dialog.showModal();
    close.focus({ preventScroll: true });
  }
  const closed = () => {
    const name = saved.dialog;
    saved.scroll = Object.fromEntries(
      Object.entries(panels).map(([key, panel]) => [key, panel.scrollTop]),
    );
    saved.dialog = "";
    const opener = byId(saved.returnFocusId);
    const target = opener && shell.contains(opener) &&
      opener.getClientRects().length && !opener.disabled
      ? opener : menuButtons[name];
    saved.returnFocusId = "";
    target?.focus({ preventScroll: true });
  };
  dialog.addEventListener("close", closed);
  // Native dialog focus is trapped; gameplay keyboard listeners must also stay
  // neutral while reference material or options are open.
  dialog.addEventListener("keydown", (event) => event.stopPropagation());
  dialog.addEventListener("keyup", (event) => event.stopPropagation());
  function show(index, focus = false) {
    saved.page = Math.max(0, Math.min(index, pages.length - 1));
    pages.forEach((nodes, i) =>
      nodes.forEach((node) => {
        node.hidden = i !== saved.page;
      }),
    );
    previous.disabled = saved.page === 0;
    next.disabled = saved.page >= pages.length - 1;
    pager.hidden = pages.length < 2;
    pageLabel.textContent = `${saved.page + 1} / ${pages.length}`;
    if (focus) {
      const first = pages[saved.page]
        ?.flatMap((n) => [
          n,
          ...n.querySelectorAll("button,input,textarea,select,[tabindex]"),
        ])
        .find(
          (n) =>
            n.matches("button,input,textarea,select,[tabindex]") &&
            !n.disabled &&
            !n.hidden,
        );
      pageAnchor = first ?? pages[saved.page]?.[0];
      first?.focus({ preventScroll: true });
    }
  }
  function layout() {
    if (destroyed) return;
    const viewport = window.visualViewport;
    document.documentElement.style.setProperty(
      "--controller-height",
      `${viewport?.height ?? innerHeight}px`,
    );
    document.documentElement.style.setProperty(
      "--controller-top",
      `${viewport?.offsetTop ?? 0}px`,
    );
    document.documentElement.style.setProperty(
      "--controller-status-height",
      `${Math.ceil(byId("status").getBoundingClientRect().height) + 5}px`,
    );
    const compact = (viewport?.height ?? innerHeight) < 550;
    shell.dataset.compact = String(compact);
    const typing = document.activeElement?.matches(
      "input:not([type=checkbox]),textarea",
    );
    shell.dataset.keyboard = String(
      !!typing &&
        ((viewport?.height ?? innerHeight) < innerHeight * 0.8 ||
          (matchMedia("(pointer:coarse)").matches &&
            (viewport?.height ?? innerHeight) < 450)),
    );
    shell.dataset.cramped = String((viewport?.height ?? innerHeight) < 300);
    surface.style.setProperty("--play-height", `${stage.clientHeight}px`);
    // Repartition on rotation as well as first mount. Reuse the actual action
    // nodes so handlers, private hands, and input values stay intact.
    const focused = surface.contains(document.activeElement)
      ? document.activeElement
      : null;
    const anchor = focused ?? pageAnchor ??
      pages[saved.page]?.[0]?.querySelector("button,input,textarea,select") ??
      pages[saved.page]?.[0];
    // Reserve navigation before sizing board groups, including the width lost
    // to landscape safe areas. Point buttons keep their existing action nodes.
    blocks.forEach((node) => { node.hidden = false; });
    pager.hidden = false;
    for (const group of choiceGroups) {
      let count = compact ? 4 : 6;
      if (group.root.matches(".backgammon-points")) {
        const landscape = matchMedia("(max-height:450px) and (orientation:landscape)").matches;
        const style = getComputedStyle(group.root);
        const columnGap = parseFloat(style.columnGap) || 0;
        const rowGap = parseFloat(style.rowGap) || 0;
        const paddingX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
        const paddingY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
        const columns = landscape && group.root.clientWidth >= 12 * 44 + 11 * columnGap + paddingX ? 12 : 6;
        for (const part of group.parts)
          part.style.setProperty("--controller-board-columns", columns);
        const fixedHeight = blocks.filter((node) => node.dataset.pinned)
          .reduce((sum, node) => sum + node.getBoundingClientRect().height + 8, 0);
        const available = stage.clientHeight - fixedHeight - paddingY - 16;
        const rows = Math.max(1, Math.min(4, Math.floor((available + rowGap) / (44 + rowGap))));
        count = Math.min(group.children.length, columns * rows);
      }
      if (group.count === count) continue;
      group.count = count;
      for (const part of group.parts.slice(1)) {
        blocks.splice(blocks.indexOf(part), 1);
        part.remove();
      }
      group.root.replaceChildren(...group.children.slice(0, count));
      group.parts = [group.root];
      let previous = group.root;
      for (let i = count; i < group.children.length; i += count) {
        const part = group.root.cloneNode(false);
        part.removeAttribute("id");
        part.append(...group.children.slice(i, i + count));
        previous.after(part);
        blocks.splice(blocks.indexOf(previous) + 1, 0, part);
        group.parts.push(part);
        previous = part;
      }
    }
    blocks.forEach((n) => {
      n.hidden = false;
    });
    // Pager space is reserved while measuring, so showing it cannot cover an action.
    pager.hidden = false;
    pages = [[]];
    let used = 0;
    const fixed = blocks.filter((b) => b.dataset.pinned),
      limit = Math.max(
        60,
        stage.clientHeight -
          8 -
          fixed.reduce(
            (sum, b) => sum + b.getBoundingClientRect().height + 8,
            0,
          ),
      );
    for (const block of blocks.filter((b) => !b.dataset.pinned)) {
      const height = block.getBoundingClientRect().height + 8;
      if (
        used &&
        (used + height > limit ||
          block.dataset.singlePage ||
          pages[pages.length - 1].some((n) => n.dataset.singlePage))
      ) {
        pages.push([]);
        used = 0;
      }
      pages[pages.length - 1].push(block);
      used += height;
    }
    // Page capacity can change without repartitioning choices (for example,
    // four-column landscape to two-column portrait). Follow the same task node
    // on every layout, rather than keeping a page number that now hides it.
    if (anchor) {
      const index = pages.findIndex((nodes) =>
        nodes.some((node) => node === anchor || node.contains(anchor)),
      );
      if (index >= 0) {
        saved.page = index;
        pageAnchor = anchor;
      }
    }
    show(saved.page);
    if (
      focused && focused.getClientRects().length &&
      document.activeElement !== focused && !focused.disabled
    )
      focused.focus({ preventScroll: true });
    surface.style.setProperty("--play-height", `${stage.clientHeight}px`);
    window.scrollTo(0, 0);
  }
  const resized = () => {
    cancelAnimationFrame(requested);
    requested = requestAnimationFrame(layout);
  };
  window.addEventListener("resize", resized);
  document.addEventListener("focusin", resized);
  document.addEventListener("focusout", resized);
  window.visualViewport?.addEventListener("resize", resized);
  // Keyboard focus can pan the visual viewport without changing its height.
  window.visualViewport?.addEventListener("scroll", resized);
  const clock = () => {
    timer.textContent = byId("timer").textContent;
    timer.dataset.urgent = byId("timer").dataset.urgent;
  };
  const timerObserver = new MutationObserver(clock);
  timerObserver.observe(byId("timer"), { childList: true, attributes: true });
  const statusObserver = new MutationObserver(() => {
    dialogFeedback.textContent = byId("status").textContent;
    resized();
  });
  statusObserver.observe(byId("status"), { childList: true });
  clock();
  active = {
    cleanup() {
      destroyed = true;
      cancelAnimationFrame(requested);
      window.removeEventListener("resize", resized);
      document.removeEventListener("focusin", resized);
      document.removeEventListener("focusout", resized);
      window.visualViewport?.removeEventListener("resize", resized);
      window.visualViewport?.removeEventListener("scroll", resized);
      timerObserver.disconnect();
      statusObserver.disconnect();
      dialog.removeEventListener("close", closed);
      if (dialog.open) {
        saved.focusId = dialog.contains(document.activeElement)
          ? document.activeElement.id
          : "";
        saved.scroll = Object.fromEntries(
          Object.entries(panels).map(([key, panel]) => [key, panel.scrollTop]),
        );
        const name = saved.dialog;
        dialog.close();
        saved.dialog = name;
      }
    },
  };
  layout();
  document.fonts?.ready.then(() => {
    if (!destroyed) resized();
  });
  if (saved.dialog) {
    open(saved.dialog);
    const focused = byId(saved.focusId);
    if (focused && dialog.contains(focused) && !focused.disabled)
      focused.focus({ preventScroll: true });
    for (const [name, panel] of Object.entries(panels))
      panel.scrollTop = saved.scroll?.[name] ?? 0;
    saved.focusId = "";
  }
}
