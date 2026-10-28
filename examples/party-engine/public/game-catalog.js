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
  const groupFor = id => cardModes.includes(id) ? "cards" : boardModes.includes(id) ? "boards" : "party";
  const play = id => { if (asHost) onChoose?.(id); else onHost?.(id); };

  const spotlight = make("section", "pick-game-spotlight");
  spotlight.setAttribute("aria-label", "Selected game preview");
  spotlight.setAttribute("aria-live", "polite");
  const previewIcon = make("span", "pick-spotlight-icon"); previewIcon.setAttribute("aria-hidden", "true");
  const previewCopy = make("div", "pick-spotlight-copy");
  const previewLabel = make("span", "sakura-eyebrow", "✿ FEATURED GAME");
  const previewName = make("h3"); const previewMeta = make("p", "pick-spotlight-meta");
  const previewRules = make("p", "pick-spotlight-rules");
  previewCopy.append(previewLabel, previewName, previewMeta, previewRules);
  const previewAction = make("button", "pick-spotlight-button");
  previewAction.type = "button";
  spotlight.append(previewIcon, previewCopy, previewAction);
  const cards = new Map();
  let previewId = selected;
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
    for (const [cardId, card] of cards) {
      const preview = card.querySelector(".pick-game-preview-button");
      card.dataset.preview = String(cardId === id);
      if (preview) preview.setAttribute("aria-pressed", String(cardId === id));
    }
  };
  const filters = make("div", "pick-game-filters");
  filters.setAttribute("role", "group");
  filters.setAttribute("aria-label", "Game categories");
  const status = make("p", "pick-game-status");
  status.setAttribute("aria-live", "polite");
  const grid = make("div", "pick-game-grid");
  const choices = [
    ["all", "All games"], ["party", "Party & trivia"],
    ["cards", "Cards & dice"], ["boards", "Board games"],
  ];
  const chooseCategory = category => {
    let visible = 0, firstVisible = null;
    for (const [id, card] of cards) {
      card.hidden = category !== "all" && category !== groupFor(id);
      if (!card.hidden) { visible++; firstVisible ??= id; }
    }
    for (const filter of filters.children) filter.setAttribute("aria-pressed", String(filter.dataset.category === category));
    status.textContent = visible + " games to choose from. Select Preview to read the rules.";
    if (firstVisible && cards.get(previewId)?.hidden) showPreview(firstVisible);
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
    const title = make("h3", null, game.icon + "  " + game.name);
    const marker = make("span", "pick-game-tag", game.tag);
    const people = make("p", "pick-game-players", game.players + " players · " + game.rounds);
    const rules = make("p", "pick-game-rules", game.rules);
    const actions = make("div", "pick-game-actions");
    const preview = make("button", "pick-game-preview-button", "Preview");
    preview.type = "button";preview.setAttribute("aria-label", "Preview " + game.name);
    preview.addEventListener("click", () => showPreview(game.id));
    const host = make("button", "pick-game-button", (asHost ? "Choose " : "Host ") + game.name);
    host.type = "button";
    host.setAttribute("aria-label", (asHost ? "Choose" : "Host") + " " + game.name + ", " + game.players + " players");
    host.addEventListener("click", () => play(game.id));
    actions.append(preview, host);
    card.append(marker, title, people, rules, actions);
    grid.append(card);cards.set(game.id,card);
  }
  container.append(spotlight, filters, status, grid);
  showPreview(cards.has(selected) ? selected : guestGames[0].id);
  chooseCategory("all");
}
