import { extraSocial } from "./content-extra.js";
import { roundContent } from "./content-rotation.js";
import { randomInt } from "node:crypto";

// Original family-friendly packs. All answer keys stay on the server.
export const socialModes = Object.freeze(["majority", "likely", "closest", "survey", "impostor"]);
const majority = [
  { prompt:"Is a hot dog a sandwich?", choices:["Absolutely","Not a chance"] },
  { prompt:"Would you rather travel through time or space?", choices:["Time","Space"] },
  { prompt:"Should pineapple go on pizza?", choices:["Yes","No"] },
  { prompt:"Which is better for a rainy day?", choices:["Movies","Board games"] },
  { prompt:"Do you prefer early mornings or late nights?", choices:["Mornings","Nights"] },
];
const likely = [
  "Who is most likely to get lost using GPS?",
  "Who is most likely to become a famous chef?",
  "Who is most likely to fall asleep during a movie?",
  "Who is most likely to win a game show?",
  "Who is most likely to adopt an unusual pet?",
];
const closest = [
  {prompt:"How many keys are on a standard modern piano?",target:88,unit:"keys"},
  {prompt:"How many minutes are there in a full day?",target:1440,unit:"minutes"},
  {prompt:"How many bones are in a typical adult human skeleton?",target:206,unit:"bones"},
  {prompt:"In what year did humans first land on the Moon?",target:1969,unit:"year"},
  {prompt:"How many squares are on a chessboard?",target:64,unit:"squares"},
];
const survey = [
 {prompt:"Name something people might forget when going on vacation.",items:["Passport","Toothbrush","Phone charger","Tickets","Sunscreen"]},
 {prompt:"Name something you might find in a movie theater.",items:["Popcorn","Seats","Screen","Tickets","Soda"]},
 {prompt:"Name something people put on pancakes.",items:["Syrup","Butter","Fruit","Chocolate","Whipped cream"]},
 {prompt:"Name something you bring to the beach.",items:["Towel","Sunscreen","Umbrella","Sunglasses","Water"]},
 {prompt:"Name something commonly found in a refrigerator.",items:["Milk","Eggs","Cheese","Vegetables","Juice"]},
];
const impostor = [
 {category:"Food",word:"Pancakes"}, {category:"Animals",word:"Penguin"},
 {category:"Places",word:"Airport"}, {category:"Objects",word:"Umbrella"},
 {category:"Activities",word:"Camping"},
];
for (const key of ["majority","likely","closest","survey","impostor"])
  ({majority,likely,closest,survey,impostor})[key].push(...extraSocial[key]);
const clean = (text) => text.toLowerCase().normalize("NFKC").replace(/[^\p{L}\p{N}]+/gu," ").trim();
export const socialPackLength = 5;
const err = (message) => { throw new Error(message); };
const active = (p,actor) => actor !== "host" && p.roster.includes(actor);

export function openSocial(p) {
  p.social = { responses:new Map(), votes:new Map(), impostorId: p.mode === "impostor" ? p.roster[randomInt(p.roster.length)] : null };
  p.enter(p.mode === "impostor" ? "clue" : "question",p.mode === "impostor" ? 45000 : 35000);
}
export function openSocialVoting(p) {
  if(p.mode !== "impostor" || p.phase !== "clue")return;
  p.enter("voting",35000);
}
export function acceptSocial(p,actor,msg) {
  if(!socialModes.includes(p.mode))err("Not a social game.");
  if(!active(p,actor))err("Only joined players may answer.");
  const s = p.social;
  if(msg.type !== "respond")err("Unknown social action.");
  if(p.mode === "impostor" && p.phase === "voting"){
    if(s.votes.has(actor))err("Vote already locked.");
    if(typeof msg.value !== "string" || !p.roster.includes(msg.value) || msg.value === actor)
      err("Pick another active player.");
    s.votes.set(actor,msg.value);
    if(s.votes.size === p.roster.length)p.closeRound();
    return;
  }
  if(p.phase !== (p.mode === "impostor" ? "clue" : "question") || s.responses.has(actor))
    err("Submission closed or already locked.");
  const v=msg.value;
  if(p.mode==="majority" && !(v===0||v===1))err("Pick one of the two choices.");
  if(p.mode==="likely" && (typeof v!=="string" || !p.roster.includes(v) || v===actor))
    err("Vote for another player.");
  if(p.mode==="closest" && (!Number.isSafeInteger(v)||v<0||v>1000000))
    err("Enter an integer from 0 to 1,000,000.");
  if(["survey","impostor"].includes(p.mode) &&
    (typeof v!=="string" || !v.trim() || v.trim().length>80 || /[\u0000-\u001f\u007f]/.test(v)))
    err("Enter 1–80 readable characters.");
  s.responses.set(actor,typeof v==="string"?v.trim():v);
  if(s.responses.size === p.roster.length){
    if(p.mode==="impostor")openSocialVoting(p);
    else p.closeRound();
  }
}
export function scoreSocial(p) {
  const s=p.social, values=[...s.responses.values()];
  const award=(id,points)=>{const player=p.players.get(id);if(player){player.score+=points;player.correct++;}};
  if(p.mode==="majority"||p.mode==="likely"){
    const counts=new Map();
    for(const val of values)counts.set(val,(counts.get(val)||0)+1);
    const highest=Math.max(0,...counts.values());
    s.winners=[...counts].filter(([,n])=>n===highest).map(([v])=>v);
    for(const [id,val] of s.responses)if(s.winners.includes(val))award(id,100);
  }else if(p.mode==="closest"){
    const answer=roundContent(p, closest, socialPackLength).target;
    const distance=Math.min(...values.map(v=>Math.abs(v-answer)));
    s.winners=[...s.responses].filter(([,v])=>Math.abs(v-answer)===distance).map(([id])=>id);
    for(const id of s.winners)award(id,100);
  }else if(p.mode==="survey"){
    const items=roundContent(p, survey, socialPackLength).items;
    for(const [id,text] of s.responses){
      const index=items.findIndex(item=>clean(item)===clean(text));
      if(index>=0)award(id,(5-index)*20);
    }
  }else if(p.mode==="impostor"){
    const targets=[...s.votes.values()].filter(id=>id===s.impostorId).length;
    for(const [id,target] of s.votes)if(target===s.impostorId)award(id,100);
    // A completely unattended vote cannot award the impostor free points.
    if(s.votes.size>0 && targets<=Math.floor(s.votes.size/4))award(s.impostorId,200);
  }
}
export function projectSocial(p,actor) {
  if(!socialModes.includes(p.mode) || !["question","clue","voting","reveal"].includes(p.phase))return null;
  const s=p.social, reveal=p.phase==="reveal", locked=p.mode==="impostor" && p.phase==="voting" ? s.votes.has(actor):s.responses.has(actor);
  const data={kind:p.mode,prompt:"",locked,received:p.mode==="impostor"&&p.phase==="voting"?s.votes.size:s.responses.size,expected:p.roster.length,total:socialPackLength};
  if(p.mode==="majority"){
    data.prompt=roundContent(p, majority, socialPackLength).prompt; data.choices=[...roundContent(p, majority, socialPackLength).choices];
    if(reveal){
      data.counts=[0,1].map(k=>[...s.responses.values()].filter(v=>v===k).length);
      data.winners=s.winners;
    }
  }else if(p.mode==="likely"){
    data.prompt=roundContent(p, likely, socialPackLength);
    data.candidates=p.roster.map(id=>({id,name:p.players.get(id).name}));
    if(reveal){
      data.counts=data.candidates.map(x=>({id:x.id,count:[...s.responses.values()].filter(v=>v===x.id).length}));
      data.winners=s.winners;
    }
  }else if(p.mode==="closest"){
    data.prompt=roundContent(p, closest, socialPackLength).prompt;
    if(reveal){
      data.target=roundContent(p, closest, socialPackLength).target;data.unit=roundContent(p, closest, socialPackLength).unit;
      data.winners=s.winners.map(id=>p.players.get(id).name);
      data.guesses=[...s.responses].map(([id,value])=>({name:p.players.get(id).name,value}));
    }
  }else if(p.mode==="survey"){
    data.prompt=roundContent(p, survey, socialPackLength).prompt;
    if(reveal)data.topAnswers=roundContent(p, survey, socialPackLength).items.map((text,index)=>({text,points:(5-index)*20,count:[...s.responses.values()].filter(v=>clean(v)===clean(text)).length}));
  }else if(p.mode==="impostor"){
    data.prompt=p.phase==="clue"?"Submit a short clue about your secret word.":"Read the clues and vote for the impostor.";
    data.category=roundContent(p, impostor, socialPackLength).category;
    if(actor!=="host" && !reveal && p.phase==="clue")
      Object.assign(data,actor===s.impostorId?{role:"impostor"}:{role:"investigator",secretWord:roundContent(p, impostor, socialPackLength).word});
    if(p.phase==="voting"||reveal){
      data.clues=p.roster.map(id=>({name:p.players.get(id).name,id,text:s.responses.get(id)??"(No clue)"}));
      data.candidates=p.roster.map(id=>({id,name:p.players.get(id).name}));
    }
    if(reveal){
      data.impostor=p.players.get(s.impostorId).name;
      data.secretWord=roundContent(p, impostor, socialPackLength).word;
      data.voteCounts=data.candidates.map(x=>({id:x.id,count:[...s.votes.values()].filter(v=>v===x.id).length}));
    }
  }
  return data;
}
