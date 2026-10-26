/**
 * One original, no-account catalog for the guest home page and host lobby.
 * These labels describe existing server-side modes; game logic stays authoritative.
 */
export const guestGames = Object.freeze([
  { id:"quiz", name:"Trivia Quiz", icon:"❓", color:"violet", players:"3–20", min:3, max:20, rounds:"5 demo questions or up to 20 of your own", rules:"Choose the correct answer before the 30-second clock ends. Earn 100 points for each correct answer.", tag:"Classic" },
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
]);
export const gameById = id => guestGames.find(g=>g.id===id);
export function mountGamePicker(container, { onHost, onChoose, selected = "quiz", asHost = false } = {}) {
  container.replaceChildren();
  const grid = document.createElement("div");
  grid.className = "pick-game-grid";
  for (const game of guestGames) {
    const card = document.createElement("article");
    card.className = "pick-game-card";
    card.dataset.tone = game.color;
    card.dataset.game = game.id;
    if (selected === game.id && asHost) card.dataset.selected = "true";
    const title = document.createElement("h3");
    title.textContent = `${game.icon}  ${game.name}`;
    const marker = document.createElement("span");
    marker.className = "pick-game-tag";
    marker.textContent = game.tag;
    const people = document.createElement("p");
    people.className = "pick-game-players";
    people.textContent = `${game.players} players · ${game.rounds}`;
    const rules = document.createElement("p");
    rules.className = "pick-game-rules";
    rules.textContent = game.rules;
    const host = document.createElement("button");
    host.type = "button";
    host.className = "pick-game-button";
    host.textContent = asHost ? `Choose ${game.name}` : `Host ${game.name}`;
    host.setAttribute("aria-label", `${asHost ? "Choose" : "Host"} ${game.name}, ${game.players} players`);
    host.addEventListener("click", () => {
      if (asHost) onChoose?.(game.id);
      else onHost?.(game.id);
    });
    card.append(marker, title, people, rules, host);
    grid.append(card);
  }
  container.append(grid);
}
