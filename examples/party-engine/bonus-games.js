import { randomInt, randomUUID } from "node:crypto";

// Small original, family-safe content packs. Kept server-side, never trusted from a client.
export const bonusModes = Object.freeze(["percentage","category","bingo","caption","timeline","bracket"]);
const fail = (message) => { throw new Error(message); };
const normalize = text => text.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu," ").trim();
const shuffle = items => {
  const shuffled=[...items];
  for(let i=shuffled.length-1;i>0;i--){const j=randomInt(i+1);[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];}
  return shuffled;
};
const polls = [
  "Would you rather live near the ocean than in the mountains?",
  "Do you put pineapple on pizza?",
  "Would you rather be able to fly than turn invisible?",
  "Do you think breakfast foods taste better at dinner?",
  "Would you trade your phone for a week of free vacation?",
];
const categories=[
 {letter:"P", category:"fruit", words:["papaya","passion fruit","peach","pear","persimmon","pineapple","plum","pomegranate","plantain"]},
 {letter:"C", category:"animal", words:["camel","capybara","cat","cheetah","chicken","chimpanzee","cobra","cougar","cow","crocodile"]},
 {letter:"B", category:"city", words:["bangkok","barcelona","beijing","berlin","bogota","boston","brussels","budapest","buenos aires"]},
 {letter:"S", category:"food", words:["salad","salmon","sandwich","sausage","soup","spaghetti","steak","stew","sushi"]},
 {letter:"M", category:"country", words:["madagascar","malaysia","maldives","mali","malta","mauritania","mexico","moldova","monaco","mongolia","morocco","mozambique","myanmar"]},
];
const timelines=[
 {prompt:"Put these milestones in chronological order (oldest first)", events:[
  ["First modern Olympic Games",1896],["First airplane powered flight",1903],["Titanic sank",1912],["Apollo 11 Moon landing",1969]]},
 {prompt:"Arrange these technology milestones (oldest first)",events:[
  ["First commercial radio broadcast (KDKA)",1920],["First email sent (ARPANET)",1971],["World Wide Web proposed",1989],["First iPhone announced",2007]]},
 {prompt:"Arrange these space milestones (oldest first)",events:[
  ["Sputnik 1 launched",1957],["Yuri Gagarin orbited Earth",1961],["Apollo 11 landed on the Moon",1969],["Voyager 1 launched",1977]]},
 {prompt:"Put these books in publication order (oldest first)",events:[
  ["Frankenstein",1818],["Alice's Adventures in Wonderland",1865],["Dracula",1897],["The Hobbit",1937]]},
 {prompt:"Arrange these sports milestones (oldest first)",events:[
  ["First FIFA World Cup",1930],["First Super Bowl",1967],["First Women's FIFA World Cup",1991],["First modern Summer Olympics in Asia (Tokyo)",1964]]},
];
const captionPrompts=[
 "Caption this scene: a penguin proudly presenting a giant pizza.",
 "Caption this scene: a robot trying to fold fitted sheets.",
 "Caption this scene: a cat giving a serious office presentation.",
 "Caption this scene: a dinosaur waiting at a bus stop.",
];
const bingoTerms=[
 "Pizza","Dog","Beach","Piano","Moon","Apple","Rainbow","Bicycle","Robot","Cat",
 "Chocolate","Tree","Penguin","Soccer","Coffee","Book","Sunglasses","Volcano",
 "Pancake","Guitar","Snowman","Dragon","Cloud","Telescope"
];
const contenders=[
 "Pizza","Tacos","Ice Cream","Popcorn","Pancakes","Waffles","Burgers","Sushi",
 "Donuts","French Fries","Chocolate","Mac & Cheese","Cookies","Pasta","Nachos","Cupcakes"
];
export const bonusRoundCount = Object.freeze({percentage:5,category:5,bingo:20,caption:4,timeline:5,bracket:15});
const live = p => p.roster.includes(p._bonusActor);
const toName=(p,id)=>p.players.get(id)?.name ?? "Unknown";
const isBingo = marked => {
 for(let r=0;r<4;r++)if([0,1,2,3].every(c=>marked.has(r*4+c)))return true;
 for(let c=0;c<4;c++)if([0,1,2,3].every(r=>marked.has(r*4+c)))return true;
 return [0,1,2,3].every(n=>marked.has(n*5)) || [0,1,2,3].every(n=>marked.has(3+n*3));
};
export function openBonus(p){
 const mode=p.mode;
 if(mode==="bracket" && !p.bonusBracket) p.bonusBracket={stage:shuffle(contenders),advance:[]};
 if(mode==="bingo" && !p.bonusBingo){
  p.bonusBingo={calls:shuffle(bingoTerms).slice(0,20),
    cards:new Map(p.roster.map(id=>[id,{cells:shuffle(bingoTerms).slice(0,16),marked:new Set(),won:false}]))};
 }
 p.bonus={entries:new Map(),votes:new Map(),options:[],winners:[],revealed:false};
 if(mode==="bracket")p.bonus.contenders=p.bonusBracket.stage.slice(p.bonusBracket.advance.length*2,p.bonusBracket.advance.length*2+2);
 if(mode==="timeline")p.bonus.events=shuffle(timelines[p.index].events.map(([title,year])=>({title,year})));
 if(mode==="caption" || mode==="percentage")p.enter("writing",mode==="caption"?55000:25000);
 else p.enter("question",mode==="bingo"?12000:mode==="bracket"?22000:35000);
}
export function openBonusVoting(p){
 if(!bonusModes.includes(p.mode) || p.phase!=="writing")return false;
 const state=p.bonus;
 if(p.mode==="caption"){
   state.options=shuffle([...state.entries].map(([author,text])=>({id:randomUUID(),author,text})));
   if(state.options.length<2){p.closeRound();return true;}
 }
 if(p.mode==="percentage" && !state.entries.size){p.closeRound();return true;}
 p.enter("voting",p.mode==="caption"?30000:25000);
 return true;
}
export function acceptBonus(p,actor,msg){
 if(!bonusModes.includes(p.mode) || actor==="host" || !p.roster.includes(actor))fail("Not a game participant.");
 if(msg.type!=="respond")fail("Invalid action for game.");
 const state=p.bonus, value=msg.value;
 if(p.phase==="question"){
   if(p.mode==="percentage" || p.mode==="caption")fail("Wrong phase.");
   if(p.mode==="bingo"){
     const card=p.bonusBingo.cards.get(actor);
     const current=p.bonusBingo.calls[p.index];
     if(!Number.isSafeInteger(value)||value<0||value>15 || card.cells[value]!==current || card.marked.has(value))
       fail("Mark only your currently called square.");
     card.marked.add(value);
     if(!card.won && isBingo(card.marked)){card.won=true;p.players.get(actor).score+=100;p.players.get(actor).correct++;state.winners.push(actor);}
     return;
   }
   if(state.entries.has(actor))fail("Your answer is already locked.");
   if(p.mode==="bracket" && (value!==0&&value!==1))fail("Choose a contender.");
   if(p.mode==="timeline" && (typeof value!=="string" || !/^[0-3],[0-3],[0-3],[0-3]$/.test(value) || new Set(value.split(",")).size!==4))
     fail("Submit each event exactly once.");
   if(p.mode==="category" && (typeof value!=="string" || !value.trim() || value.trim().length>55 || /[\u0000-\u001f\u007f]/.test(value)))
     fail("Enter a short category answer.");
   state.entries.set(actor,typeof value==="string"?value.trim():value);
   if(state.entries.size===p.roster.length)p.closeRound();
   return;
 }
 if(p.phase==="writing"){
   if(state.entries.has(actor))fail("Your submission is already locked.");
   if(p.mode==="caption"){
     if(typeof value!=="string" || !value.trim() || value.trim().length>80 || /[\u0000-\u001f\u007f]/.test(value))
       fail("Enter a caption of 1–80 characters.");
     state.entries.set(actor,value.trim());
   }else if(p.mode==="percentage"){
     if(value!==0&&value!==1)fail("Vote yes or no.");
     state.entries.set(actor,value);
   }else fail("Wrong phase.");
   if(state.entries.size===p.roster.length)openBonusVoting(p);
   return;
 }
 if(p.phase==="voting"){
   if(state.votes.has(actor))fail("Your vote is already locked.");
   if(p.mode==="percentage"){
     if(!Number.isSafeInteger(value)||value<0||value>100)fail("Choose 0–100 percent.");
   }else if(p.mode==="caption"){
     if(typeof value!=="string" || !state.options.some(o=>o.id===value&&o.author!==actor))fail("Vote for somebody else's caption.");
   }else fail("Wrong phase.");
   state.votes.set(actor,value);
   const eligible=p.mode==="caption"?p.roster.filter(id=>state.options.some(o=>o.author!==id)):p.roster;
   if(state.votes.size===eligible.length)p.closeRound();
   return;
 }
 fail("This round is closed.");
}
export function scoreBonus(p){
 const state=p.bonus; state.revealed=true;
 const award=(id,pts)=>{const player=p.players.get(id);if(player&&pts>0){player.score+=pts;player.correct++;}};
 if(p.mode==="bracket"){
   const totals=[0,1].map(x=>[...state.entries.values()].filter(v=>v===x).length);
   const winner=totals[0]===totals[1]?0:totals[0]>totals[1]?0:1; // Explicit lower-seed tie break.
   state.counts=totals;state.winner=winner;
   for(const [id,v] of state.entries)if(v===winner)award(id,100);
   const bracket=p.bonusBracket;bracket.advance.push(state.contenders[winner]);
   if(bracket.advance.length===bracket.stage.length/2){
     bracket.stage=bracket.advance;bracket.advance=[];
   }
 }else if(p.mode==="timeline"){
   const correct=[...state.events].map((e,i)=>({i,year:e.year})).sort((a,b)=>a.year-b.year).map(e=>e.i);
   state.correctOrder=correct;
   for(const [id,answer] of state.entries){
      const submitted=answer.split(",").map(Number);
      award(id,submitted.reduce((n,choice,i)=>n+(choice===correct[i]?25:0),0));
   }
 }else if(p.mode==="category"){
   const pack=categories[p.index],bank=new Set(pack.words.map(normalize));
   const counts=new Map();
   for(const v of state.entries.values()){const key=normalize(v);if(bank.has(key))counts.set(key,(counts.get(key)||0)+1);}
   state.answers=pack.words;
   state.results=[];
   for(const [id,v] of state.entries){
     const norm=normalize(v),valid=bank.has(norm),score=valid?(counts.get(norm)===1?100:50):0;
     award(id,score);
     state.results.push({name:toName(p,id),answer:v,points:score});
   }
 }else if(p.mode==="caption"){
   const tallies=new Map();
   for(const selected of state.votes.values())tallies.set(selected,(tallies.get(selected)||0)+1);
   state.results=state.options.map(o=>({id:o.id,name:toName(p,o.author),text:o.text,votes:tallies.get(o.id)||0}));
   for(const option of state.options)award(option.author,(tallies.get(option.id)||0)*100);
 }else if(p.mode==="percentage"){
   state.yes=[...state.entries.values()].filter(v=>v===1).length;
   state.total=state.entries.size;
   state.actual=state.total?Math.round(100*state.yes/state.total):null;
   if(state.total)for(const [id,guess] of state.votes)award(id,Math.max(0,100-2*Math.abs(guess-state.actual)));
 }else if(p.mode==="bingo"){
   state.draw=p.bonusBingo.calls[p.index];
 }
}
export function projectBonus(p,actor){
 if(!bonusModes.includes(p.mode) || !["question","writing","voting","reveal"].includes(p.phase))return null;
 const st=p.bonus,reveal=p.phase==="reveal";
 const view={kind:p.mode,round:p.index+1,total:bonusRoundCount[p.mode],received:(p.phase==="voting"?st.votes:st.entries).size,expected:p.roster.length,
   locked:(p.phase==="voting"?st.votes:st.entries).has(actor)};
 if(p.mode==="bracket"){
   view.prompt="Which should advance?";view.contenders=[...st.contenders];
   if(reveal){view.counts=st.counts;view.winner=st.winner;}
 }else if(p.mode==="timeline"){
   view.prompt=timelines[p.index].prompt;view.events=st.events.map(e=>e.title);
   if(reveal)view.correctOrder=st.correctOrder;
 }else if(p.mode==="category"){
   const item=categories[p.index];view.prompt="Name a "+item.category+" starting with "+item.letter+".";
   if(reveal){view.allowed=st.answers;view.results=st.results;}
 }else if(p.mode==="caption"){
   view.prompt=captionPrompts[p.index];
   if(p.phase==="voting"||reveal)view.options=st.options.map(o=>({id:o.id,text:o.text,
     ...(reveal?{name:toName(p,o.author),votes:st.votes.size?[...st.votes.values()].filter(x=>x===o.id).length:0}:{})}));
   if(p.phase==="voting")view.votable=st.options.filter(o=>o.author!==actor).map(o=>o.id);
   if(reveal)view.results=st.results;
 }else if(p.mode==="percentage"){
   view.prompt=polls[p.index];
   if(p.phase==="voting")view.prompt="What percentage of your group voted YES? (0–100)";
   if(reveal){view.actual=st.actual;view.yes=st.yes;view.totalVotes=st.total;view.prompt=polls[p.index];}
 }else if(p.mode==="bingo"){
   view.prompt="Called word: "+p.bonusBingo.calls[p.index];
   if(actor!=="host"){
     const card=p.bonusBingo.cards.get(actor);
     view.card=[...card.cells];view.marks=[...card.marked];view.won=card.won;
   }
   if(reveal)view.winners=st.winners.map(id=>toName(p,id));
 }
 return view;
}
