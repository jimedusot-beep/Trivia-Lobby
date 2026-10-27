// Original forbidden-word party mode, inspired by the general Buzzwort/Taboo genre.
// All prompts, actions and scoring below are authored for Trivia Lobby; no upstream
// Open Party Lab source code, assets or word lists are redistributed.
import { fail, requireFields } from "./shared.js";

const CARDS = [
  { word:"Friendly Robot", forbidden:["machine","metal","computer","helper"] },
  { word:"Moon Picnic", forbidden:["space","astronaut","sandwich","rocket"] },
  { word:"Haunted Library", forbidden:["ghost","books","scary","read"] },
  { word:"Underwater Castle", forbidden:["ocean","king","fish","water"] },
  { word:"Time Traveler", forbidden:["past","future","clock","history"] },
  { word:"Dragon Bakery", forbidden:["fire","bread","wings","cake"] },
  { word:"Flying Bicycle", forbidden:["pedal","wheels","sky","ride"] },
  { word:"Invisible Pirate", forbidden:["ship","treasure","sea","see"] },
  { word:"Robot Detective", forbidden:["clue","crime","robot","mystery"] },
  { word:"Volcano Vacation", forbidden:["lava","mountain","holiday","hot"] },
  { word:"Alien Gardening", forbidden:["plants","space","green","planet"] },
  { word:"Penguin Orchestra", forbidden:["music","bird","ice","instruments"] },
  { word:"Wizard School", forbidden:["spell","magic","student","wand"] },
  { word:"Miniature City", forbidden:["tiny","buildings","roads","people"] },
  { word:"Secret Treehouse", forbidden:["branches","children","ladder","hide"] },
  { word:"Cloud Aquarium", forbidden:["sky","fish","glass","water"] },
]);
// Make enough distinct, original cards for a whole 20-person, five-card round.
// Combinations produce whimsical family-friendly phrases; each gets two forbidden
// words from its modifier and two from its subject, without runtime generation.
const TWISTS = [
  ["Clockwork",["gears","spring"]],["Midnight",["night","dark"]],
  ["Rainbow",["colors","arc"]],["Frozen",["ice","cold"]],
  ["Undercover",["secret","disguise"]],["Jungle",["forest","vines"]],
  ["Superhero",["cape","powers"]],["Enchanted",["spell","magic"]],
  ["Tiny",["small","miniature"]],["Gigantic",["huge","giant"]],
  ["Cosmic",["galaxy","stars"]],["Whispering",["quiet","voice"]],
];
const OBJECTS = [
  ["Carnival",["fair","rides"]],["Train",["tracks","rail"]],
  ["Garden",["flowers","plants"]],["Submarine",["ocean","underwater"]],
  ["Museum",["art","exhibit"]],["Robot",["machine","metal"]],
  ["Restaurant",["food","menu"]],["Mountain",["climb","peak"]],
  ["Theater",["stage","actors"]],["Spaceship",["rocket","astronaut"]],
  ["Zoo",["animals","cages"]],["Lighthouse",["beacon","coast"]],
];
const GENERATED_CARDS = TWISTS.flatMap(([modifier, bannedA]) =>
  OBJECTS.map(([subject, bannedB]) => ({
    word: `${modifier} ${subject}`, forbidden: [...bannedA,...bannedB],
  }))
);
CARDS.push(...GENERATED_CARDS);
export const FORBIDDEN_UNIQUE_CARD_COUNT = CARDS.length;
export const FORBIDDEN_DURATION_MS = 45000;
export const FORBIDDEN_CARDS_PER_TURN = 5;
const cardFor = (p, cursor) => CARDS[(p.index * FORBIDDEN_CARDS_PER_TURN + cursor) % CARDS.length];

export function openForbidden(p) {
  if (!p.roster || p.roster.length < 3) fail("Forbidden Words needs at least three people.");
  p.pack = { kind:"forbidden", giver:p.roster[p.index], referee:p.roster[(p.index + 1) % p.roster.length],
    cursor:0, history:[], lastMarkAt:-Infinity, finishedCards:0 };
  p.enter("playing", FORBIDDEN_DURATION_MS);
}
export function acceptForbidden(p, actor, value) {
  requireFields(value, ["action"]);
  const s=p.pack;
  if (s?.kind!=="forbidden" || p.phase!=="playing") fail("Forbidden Words is not active.");
  if (actor!==s.referee || !p.players.get(actor)?.connected) fail("Only this turn's referee can mark a word.");
  if (!["correct","forbidden","pass"].includes(value.action)) fail("Unknown forbidden-word mark.");
  if (s.cursor>=FORBIDDEN_CARDS_PER_TURN || p.clock()>=p.deadline) fail("This turn has ended.");
  if (p.clock()-s.lastMarkAt<350) fail("Wait between judgments.");
  const card=cardFor(p,s.cursor);
  if (value.action==="correct") { p.players.get(s.giver).score+=20; p.players.get(s.giver).correct++; }
  else if (value.action==="forbidden") p.players.get(s.giver).score=Math.max(0,p.players.get(s.giver).score-10);
  s.history.push({word:card.word,result:value.action});
  s.cursor++; s.finishedCards=s.history.length; s.lastMarkAt=p.clock();
  if (s.cursor>=FORBIDDEN_CARDS_PER_TURN) p.enter("reveal");
  else { p.revision++; p.touched=p.clock(); }
}
export function tickForbidden(p) {
  if (p.mode==="no-say" && p.phase==="playing" && p.pack?.kind==="forbidden") p.enter("reveal");
}
export function nextForbidden(p) {
  if (++p.index>=p.roster.length) p.enter("finished");
  else {p.pack=null;p.enter("countdown",p.countdownMs);}
}
export function projectForbidden(p,actor) {
  const s=p.pack;
  const privateCard=actor===s.giver || actor===s.referee;
  const show=privateCard && p.phase==="playing" && s.cursor<FORBIDDEN_CARDS_PER_TURN;
  const current=show?cardFor(p,s.cursor):null;
  const results=p.phase==="reveal" || p.phase==="finished";
  return {
    kind:"forbidden", turn:p.index+1, totalTurns:p.roster.length, durationMs:FORBIDDEN_DURATION_MS,
    giver:p.players.get(s.giver).name, referee:p.players.get(s.referee).name,
    canJudge:actor===s.referee && p.phase==="playing",
    role:actor===s.giver?"giver":actor===s.referee?"referee":"guesser",
    completed:s.finishedCards,totalCards:FORBIDDEN_CARDS_PER_TURN,
    ...(current?{card:{word:current.word,forbidden:[...current.forbidden]}}:{}),
    ...(results?{history:s.history.map(x=>({...x}))}:{}),
  };
}
