/**
 * One original, no-account catalog for the guest home page and host lobby.
 * These labels describe existing server-side modes; game logic stays authoritative.
 */
import { packGames } from "./pack-config.js";
export const guestGames = Object.freeze([
  { id:"quiz", name:"Trivia Quiz", icon:"❓", color:"violet", players:"3–20", min:3, max:20, rounds:"5 demo questions or up to 20 of your own", rules:"Choose the correct answer before the clock ends. Sample rounds allow 30 seconds and award 100 points; imported quizzes can set their own timers and scoring.", tag:"Classic" },
  { id:"duel", name:"Prompt Duel", icon:"💬", color:"pink", players:"3–20", min:3, max:20, rounds:"One matchup per player", rules:"Write two funny responses, then vote on other players' answers. Each vote earns its author 100 points.", tag:"Creative" },
  { id:"charades", name:"Charades", icon:"🎭", color:"orange", players:"3–20", min:3, max:20, rounds:"One acting turn per player", rules:"Act out the private clue, let family guess, then mark Correct or Pass before the 60-second timer ends.", tag:"Act it out" },
  { id:"majority", name:"Majority Rules", icon:"🗳️", color:"blue", players:"3–20", min:3, max:20, rounds:"5 votes", rules:"Pick one of two choices. The most popular choice wins 100 points for its voters; a tie rewards both sides.", tag:"Quick votes" },
  { id:"likely", name:"Who's Most Likely?", icon:"👀", color:"pink", players:"3–20", min:3, max:20, rounds:"5 nominations", rules:"Secretly nominate someone else for a funny prompt. Players who choose the top nominee score 100.", tag:"Know your crew" },
  { id:"closest", name:"Closest Wins", icon:"🎯", color:"teal", players:"3–20", min:3, max:20, rounds:"5 estimates", rules:"Guess a whole number. Closest valid guesses earn 100 points; the correct answer stays hidden until reveal.", tag:"Big guesses" },
  { id:"survey", name:"Survey Showdown", icon:"📊", color:"yellow", players:"3–20", min:3, max:20, rounds:"5 prompts", rules:"Name an answer from the host's curated survey board. The highest-ranked matches earn the most points.", tag:"Family favorites" },
  { id:"impostor", name:"Secret Impostor", icon:"🕵️", color:"violet", players:"3–20", min:3, max:20, rounds:"5 mysteries", rules:"Everyone gives a clue, but one player has no secret word. Vote to find the impostor before the reveal.", tag:"Mystery" },
  { id:"percentage", name:"Guess the Percentage", icon:"💯", color:"teal", players:"3–20", min:3, max:20, rounds:"5 polls", rules:"Vote Yes or No, then guess how many players voted Yes. Closer percentages earn more points.", tag:"Prediction" },
  { id:"category", name:"Category Clash", icon:"🔠", color:"blue", players:"3–20", min:3, max:20, rounds:"5 word rounds", rules:"Think of a valid word beginning with the given letter. Unique accepted answers earn extra points.", tag:"Word game" },
  { id:"bingo", name:"Family Bingo", icon:"🎟️", color:"orange", players:"3–20", min:3, max:20, rounds:"20 calls", rules:"Look at your private 4×4 card. Mark the announced words and race to complete a full line.", tag:"Every age" },
  { id:"caption", name:"Caption Chaos", icon:"📸", color:"pink", players:"3–20", min:3, max:20, rounds:"4 scenes", rules:"Write a caption for a silly scene, then vote for someone else's caption. Each vote gives 100 points.", tag:"Laugh out loud" },
  { id:"timeline", name:"Timeline Tangle", icon:"🕰️", color:"blue", players:"3–20", min:3, max:20, rounds:"5 timelines", rules:"Place four shuffled events in chronological order. Earn 25 points for each correct position.", tag:"Put in order" },
  { id:"bracket", name:"Bracket Battle", icon:"🏆", color:"yellow", players:"3–20", min:3, max:20, rounds:"15 matchups", rules:"Vote for the winner of each showdown. Correct votes earn points as contenders advance.", tag:"Tournament" },
  { id:"turbo", name:"Turbo Circuit", icon:"🏎️", color:"orange", players:"3–20", min:3, max:20, rounds:"90-second race", rules:"Race your original kart through three lanes. Toggle GAS, dodge cones and use a timed speed boost. The server determines positions and results.", tag:"Arcade racing" },
  { id:"wave", name:"Wave Sprint", icon:"🌊", color:"teal", players:"3–20", min:3, max:20, rounds:"90-second race", rules:"Race a jet ski across three buoy-marked lanes. Dodge choppy water, build speed and launch your boost to win.", tag:"Water racing" },
  ...packGames,
]);
export const gameById = id => guestGames.find(g=>g.id===id);
export function mountGamePicker(container, { onHost, onChoose, selected = "quiz", asHost = false } = {}) {
  container.replaceChildren();
  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const cardModes = ["colors", "table"], boardModes = ["homeward", "four", "chess", "checkers", "reversi", "mancala", "backgammon"];
  const arcadeModes = ["race", "turbo", "wave", "tap", "trails"];
  const groupFor = id => cardModes.includes(id) ? "cards" : boardModes.includes(id) ? "boards" : arcadeModes.includes(id) ? "arcade" : "party";
  const play = id => { if (asHost) onChoose?.(id); else onHost?.(id); };

  const spotlight = make("section", "pick-game-spotlight");
  spotlight.setAttribute("aria-label", "Selected game preview");
  spotlight.setAttribute("aria-live", "polite");
  const previewIcon = make("span", "pick-spotlight-icon"); previewIcon.setAttribute("aria-hidden", "true");
  const previewCopy = make("div", "pick-spotlight-copy");
  const previewLabel = make("span", "sakura-eyebrow", "YOUR NEXT GAME");
  const previewName = make("h3"); previewName.tabIndex = -1; const previewMeta = make("p", "pick-spotlight-meta");
  const previewRules = make("p", "pick-spotlight-rules");
  previewCopy.append(previewLabel, previewName, previewMeta, previewRules);
  const previewAction = make("button", "pick-spotlight-button");
  previewAction.type = "button";
  spotlight.append(previewIcon, previewCopy, previewAction);
  const cards = new Map();
  let previewId = selected;
  const visibleIds = () => [...cards.keys()].filter(id => !cards.get(id).hidden);
  const syncShelf = () => {
    const ids = visibleIds(), position = ids.indexOf(previewId);
    shelfPosition.textContent = ids.length ? `${position + 1} / ${ids.length}` : "0 / 0";
    previous.disabled = position <= 0;
    next.disabled = position < 0 || position >= ids.length - 1;
  };
  const showPreview = id => {
    const game = gameById(id);
    if (!game) return;
    previewId = id;
    previewIcon.textContent = game.icon;
    previewName.textContent = game.name;
    previewMeta.textContent = game.players + " players · " + game.rounds + " · " + game.tag;
    previewRules.textContent = game.rules;
    previewAction.textContent = (asHost ? "Choose " : "Host ") + game.name + "  →";
    previewAction.setAttribute("aria-label", (asHost ? "Choose " : "Host ") + game.name);
    previewAction.onclick = () => play(game.id);
    spotlight.dataset.tone = game.color;
    spotlight.dataset.genre = groupFor(game.id);
    grid.dataset.activeGame = game.id;
    for (const [cardId, card] of cards) {
      const preview = card.querySelector(".pick-game-preview-button");
      card.dataset.preview = String(cardId === id);
      if (preview) preview.setAttribute("aria-pressed", String(cardId === id));
    }
    syncShelf();
  };
  const moveSelection = (delta, focusPoster = false) => {
    const ids = visibleIds(), index = ids.indexOf(previewId);
    if (!ids.length) return;
    const id = ids[Math.max(0, Math.min(ids.length - 1, index + delta))];
    showPreview(id);
    const poster = cards.get(id)?.querySelector(".pick-game-preview-button");
    poster?.scrollIntoView({ block: "nearest", inline: "center",
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    if (focusPoster) poster?.focus({ preventScroll: true });
  };
  previous.addEventListener("click", () => moveSelection(-1));
  next.addEventListener("click", () => moveSelection(1));
  const handleArrows = event => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    event.preventDefault();
    moveSelection(event.key === "ArrowLeft" ? -1 : 1, true);
  };
  grid.addEventListener("keydown", handleArrows);
  spotlight.addEventListener("keydown", handleArrows);
  const toolbar = make("div", "pick-game-toolbar");
  const searchLabel = make("label", "pick-game-search-label", "Find your next game");
  const search = make("input", "pick-game-search");
  search.type = "search"; search.placeholder = "Search games or play styles";
  searchLabel.append(search);
  const filters = make("div", "pick-game-filters");
  filters.setAttribute("role", "group");
  filters.setAttribute("aria-label", "Game categories");
  const status = make("p", "pick-game-status");
  status.setAttribute("aria-live", "polite");
  // The selected game reads as a featured title above a horizontal console shelf.
  // Keep all original launch buttons, IDs, category filters and search results.
  const grid = make("div", "pick-game-grid");
  grid.setAttribute("role", "region");
  grid.setAttribute("aria-label", "Horizontal game cover shelf");
  grid.tabIndex = 0;
  const shelf = make("section", "pick-game-shelf");
  shelf.setAttribute("aria-label", "Choose a game from the cover shelf");
  const shelfNav = make("div", "pick-shelf-nav");
  const shelfHint = make("p", "pick-shelf-hint", "CHOOSE YOUR NEXT GAME  ·  ← → BROWSE");
  const shelfPosition = make("span", "pick-shelf-position");
  shelfPosition.setAttribute("aria-live", "polite");
  const previous = make("button", "pick-shelf-arrow pick-shelf-prev", "←");
  previous.type = "button"; previous.setAttribute("aria-label", "Previous game");
  const next = make("button", "pick-shelf-arrow pick-shelf-next", "→");
  next.type = "button"; next.setAttribute("aria-label", "Next game");
  shelfNav.append(shelfHint, shelfPosition, previous, next);
  shelf.append(shelfNav, grid);
  const choices = [
    ["all", "All games"], ["party", "Party & trivia"],
    ["arcade", "Racing & arcade"], ["cards", "Cards & dice"], ["boards", "Board games"],
  ];
  let activeCategory = "all";
  const empty = make("div", "pick-game-empty");
  const emptyMessage = make("p", null, "No games found. Try another search or category.");
  const reset = make("button", "pick-spotlight-button", "Show all games");
  reset.type = "button";
  reset.addEventListener("click", () => {
    search.value = "";
    chooseCategory("all");
    search.focus();
  });
  empty.append(emptyMessage, reset);
  empty.hidden = true;
  const chooseCategory = category => {
    activeCategory = category;
    const query = search.value.trim().toLocaleLowerCase();
    let visible = 0, firstVisible = null;
    for (const [id, card] of cards) {
      const game = gameById(id);
      card.hidden = (category !== "all" && category !== groupFor(id)) ||
        ![game.name, game.tag, game.rules].join(" ").toLocaleLowerCase().includes(query);
      if (!card.hidden) { visible++; firstVisible ??= id; }
    }
    for (const filter of filters.children) filter.setAttribute("aria-pressed", String(filter.dataset.category === category));
    status.textContent = visible + " of " + guestGames.length + " games · Preview the rules, then " + (asHost ? "choose your game." : "host a party.");
    empty.hidden = visible !== 0;
    spotlight.hidden = visible === 0;
    grid.scrollLeft = 0;
    if (firstVisible && cards.get(previewId)?.hidden) showPreview(firstVisible);
    syncShelf();
  };
  for (const [category,label] of choices) {
    const filter = make("button", null, label);
    filter.type = "button"; filter.dataset.category = category;
    filter.addEventListener("click", () => chooseCategory(category));
    filters.append(filter);
  }
  for (const game of guestGames) {
    const card = make("article", "pick-game-card");
    card.dataset.tone = game.color; card.dataset.game = game.id;
    if (selected === game.id && asHost) card.dataset.selected = "true";
    const art = make("button", "pick-game-art pick-game-preview-button");
    art.type = "button";
    art.dataset.genre = groupFor(game.id);
    art.setAttribute("aria-label", "Preview " + game.name);
    const posterOrbit = make("span", "pick-game-art-orbit");
    const posterIcon = make("span", "pick-game-art-icon", game.icon);
    const posterKicker = make("span", "pick-poster-kicker", "TRIVIA LOBBY · GAME LIBRARY");
    const posterTitle = make("span", "pick-poster-title", game.name);
    const posterTag = make("span", "pick-poster-tag", game.tag);
    for (const element of [posterOrbit, posterIcon, posterKicker, posterTitle, posterTag])
      element.setAttribute("aria-hidden", "true");
    art.append(posterOrbit, posterIcon, posterKicker, posterTitle, posterTag);
    art.addEventListener("click", () => {
      showPreview(game.id);
      previewName.focus({ preventScroll: true });
      spotlight.scrollIntoView({ block: "start",
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    });
    const title = make("h3", null, game.name);
    const marker = make("span", "pick-game-tag", game.tag);
    const people = make("p", "pick-game-players", game.players + " players · " + game.rounds);
    const rules = make("p", "pick-game-rules", game.rules);
    const actions = make("div", "pick-game-actions");
    const host = make("button", "pick-game-button", (asHost ? "Choose " : "Host ") + game.name);
    host.type = "button";
    host.setAttribute("aria-label", (asHost ? "Choose" : "Host") + " " + game.name + ", " + game.players + " players");
    host.addEventListener("click", () => play(game.id));
    actions.append(host);
    card.append(art, marker, title, people, rules, actions);
    grid.append(card);cards.set(game.id,card);
  }
  search.addEventListener("input", () => chooseCategory(activeCategory));
  search.addEventListener("keydown", event => {
    if (event.key !== "Escape" || !search.value) return;
    event.preventDefault();
    search.value = "";
    chooseCategory(activeCategory);
  });
  toolbar.append(searchLabel, filters);
  container.append(spotlight, toolbar, status, empty, shelf);
  showPreview(cards.has(selected) ? selected : guestGames[0].id);
  chooseCategory("all");
}
