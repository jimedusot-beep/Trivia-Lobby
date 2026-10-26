// Original catalog metadata researched from the corresponding public Open Party Lab
// game manifests on 2026-10-26. Descriptions here are authored for Trivia Lobby.
// These are UPSTREAM limits, not validation that games are installed or work at capacity.
export const openPartyLabBaseline = Object.freeze({
  source: "https://github.com/Hartwich/Open-Party-Lab",
  revision: "bb221f92d1b29afce1cd5b3953c7450612d52a71",
  verifiedOn: "2026-10-26",
});

export const openPartyLabGames = Object.freeze([
  { id: "magic-arena", name: "Magic Arena", genre: "Strategy", description: "Hex-grid tactical wizard battles", min: 2, max: 4, controller: "Tactics board", repository: "https://github.com/Hartwich/magic-arena" },
  { id: "magic-duell", name: "Magic Duell", genre: "Action", description: "Draw spells on your phone in a two-player duel", min: 2, max: 2, controller: "Drawn spells", repository: "https://github.com/Hartwich/magic-duell" },
  { id: "tap-race", name: "Tap Race", genre: "Arcade", description: "Mash a big phone button to win a sprint", min: 1, max: 8, controller: "Tap button", repository: "https://github.com/Hartwich/tap-race" },
  { id: "pantomime", name: "Pantomime", genre: "Party", description: "Act out secret prompts for friends or teams", min: 2, max: 10, controller: "Private prompts", repository: "https://github.com/Hartwich/pantomime" },
  { id: "air-hockey", name: "Air Hockey", genre: "Arcade", description: "Two-player arcade air hockey", min: 2, max: 2, controller: "Virtual joystick", repository: "https://github.com/Hartwich/air-hockey" },
  { id: "buzzwort", name: "Buzzwort", genre: "Words", description: "Give clues without using forbidden words", min: 3, max: 20, controller: "Private clue card", repository: "https://github.com/Hartwich/buzzwort" },
  { id: "imposter", name: "Imposter", genre: "Social", description: "Find the person who never saw the secret word", min: 3, max: 20, controller: "Private voting", repository: "https://github.com/Hartwich/imposter" },
  { id: "schaetzorama", name: "Schaetzorama", genre: "Trivia", description: "Compete on estimation and ranking questions", min: 1, max: 8, controller: "Estimate controls", repository: "https://github.com/Hartwich/schaetzorama" },
  { id: "light-trails", name: "Light Trails", genre: "Arcade", description: "Steer light trails and avoid crashing", min: 1, max: 8, controller: "Left/right controls", repository: "https://github.com/Hartwich/light-trails" },
  { id: "drift-racer", name: "Drift Racer", genre: "Racing", description: "RC-style 3D racing with drift and boosts", min: 1, max: 4, controller: "Racing controls", repository: "https://github.com/Hartwich/drift-racer" },
  { id: "word-tiles", name: "Word Tiles", genre: "Words", description: "Play a shared board-based word challenge", min: 2, max: 4, controller: "Word board", repository: "https://github.com/Hartwich/word-tiles" },
  { id: "zeichnen-und-erraten", name: "Zeichnen & Erraten", genre: "Drawing", description: "Draw secret prompts and have others guess", min: 2, max: 20, controller: "Drawing pad", repository: "https://github.com/Hartwich/zeichnen-und-erraten" },
  { id: "arena-survivor", name: "Arena Survivor", genre: "Survival", description: "Survive waves of enemies together", min: 1, max: 4, controller: "Virtual joystick", repository: "https://github.com/Hartwich/arena-survivor" },
  { id: "minions-td", name: "MinionsTD", genre: "Strategy", description: "Competitive tower defense with phone choices", min: 2, max: 4, controller: "Tower controls", repository: "https://github.com/Hartwich/minions-td" },
  { id: "chaos-kommando", name: "Chaos-Kommando", genre: "Action", description: "Turn-based artillery fights", min: 2, max: 6, controller: "Movement and aiming", repository: "https://github.com/Hartwich/chaos-kommando" },
  { id: "schattenjagd", name: "Schattenjagd", genre: "Mystery", description: "Social deduction and hidden-role guessing", min: 3, max: 8, controller: "Choice controls", repository: "https://github.com/Hartwich/schattenjagd" },
  { id: "flatterfluff", name: "Flatterfluff", genre: "Arcade", description: "Comic-style gallery shooter", min: 1, max: 6, controller: "Virtual joystick", repository: "https://github.com/Hartwich/flatterfluff" },
  { id: "dungeon-party", name: "Dungeon Party", genre: "Adventure", description: "Cooperative dungeon adventure with competitive points", min: 3, max: 8, controller: "Dungeon actions", repository: "https://github.com/Hartwich/dungeon-party" },
  { id: "card-table", name: "Kartentisch (Card Table)", genre: "Cards", description: "Shared card table with multiple rulesets", min: 1, max: 16, controller: "Private card hand", repository: "https://github.com/Hartwich/card-table" },
  { id: "blickwinkel", name: "Blickwinkel", genre: "Creative", description: "Photography and drawing tasks with voting", min: 1, max: 16, controller: "Photo and drawing", repository: "https://github.com/Hartwich/blickwinkel" },
  { id: "dungeon-guild", name: "Dungeon-Gilde", genre: "Adventure", description: "Cooperative dungeon-party prototype", min: 3, max: 6, controller: "Dungeon actions", repository: "https://github.com/Hartwich/dungeon-guild" },
].map((game) => Object.freeze(game)));
