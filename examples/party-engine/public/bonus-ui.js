// All guest-authored text is inserted via textContent, not HTML.
export function renderBonus(state,{element,button,action,actor}){
 const b=state.bonus,host=state.role==="host",reveal=state.phase==="reveal";
 const answerable=!host&&!reveal&&!b.locked;
 element("h2",b.prompt).className="social-prompt";
 element("p","Round "+b.round+" of "+b.total+" · "+b.received+" submitted");
 const key="family-draft:"+state.matchId+":"+b.kind+":"+b.round+":"+state.phase;
 function typed(label,{maxLength=80,numeric=false,multiline=false}={}){
  if(!answerable)return;
  const wrap=element("div");wrap.className="social-entry";
  const lbl=element("label",label,wrap);
  const input=element(multiline?"textarea":"input",undefined,wrap);
  input.id="family-response";lbl.htmlFor=input.id;input.maxLength=maxLength;
  if(multiline)input.rows=3;
  else input.type=numeric?"number":"text";
  if(numeric){input.min="0";input.max="100";input.step="1";input.inputMode="numeric";}
  try{input.value=sessionStorage.getItem(key)||"";}catch{}
  input.oninput=()=>{try{sessionStorage.setItem(key,input.value);}catch{}};
  button("Lock answer",()=>{
   const value=numeric?(input.value===""?NaN:Number(input.value)):input.value.trim();
   action("respond",value);
  },wrap);
 }
 if(b.kind==="bracket"){
   element("h3","Choose one to advance.");
   b.contenders.forEach((text,i)=>{
     if(answerable)button(text,()=>action("respond",i));
     else element("p",reveal?text+" · "+b.counts[i]+" votes"+(b.winner===i?" · Advances":""):text);
   });
   if(reveal)element("p","Winner: "+b.contenders[b.winner]);
 }
 if(b.kind==="timeline"){
   if(answerable){
     const wrap=element("div");wrap.className="timeline-list";
     element("p","Put these four events in order, earliest first.",wrap);
     const selects=[];
     const saved=(()=>{try{return sessionStorage.getItem(key)||""}catch{return""}})().split(",");
     for(let i=0;i<4;i++){
       const label=element("label","Position "+(i+1),wrap);
       const select=element("select",undefined,wrap);select.id="timeline-"+i;label.htmlFor=select.id;
       const placeholder=element("option","Choose an event",select);placeholder.value="";
       b.events.forEach((text,j)=>{const option=element("option",text,select);option.value=String(j)});
       if(saved[i]!==undefined && saved[i]!=="")select.value=saved[i];
       selects.push(select);
     }
     for(const select of selects)select.onchange=()=>{
       try{sessionStorage.setItem(key,selects.map(x=>x.value).join(","))}catch{}
     };
     button("Submit order",()=>{
       const values=selects.map(s=>s.value);
       if(values.some(v=>v==="")||new Set(values).size!==4){element("p","Choose four different events.");return;}
       action("respond",values.join(","));
     },wrap);
   }else {
     b.events.forEach((e,i)=>element("p",(i+1)+". "+e));
   }
   if(reveal){element("h3","Correct order");b.correctOrder.forEach((pos,i)=>element("p",(i+1)+". "+b.events[pos]));}
 }
 if(b.kind==="category"){
   typed("Your valid category answer",{maxLength:55});
   if(reveal){
     element("p","Valid answers in this starter pack: "+b.allowed.join(", ")+".");
     for(const r of b.results)element("p",r.name+" — "+r.answer+" ("+r.points+" pts)");
   }
 }
 if(b.kind==="caption"){
   if(state.phase==="writing"){
     element("p","Invent your funniest family-friendly caption.");
     typed("Your caption (80 characters maximum)",{maxLength:80,multiline:true});
   }
   if(state.phase==="voting"){
     element("p","Vote for somebody else's caption.");
     for(const opt of b.options) {
       if(answerable && b.votable.includes(opt.id))button(opt.text,()=>action("respond",opt.id));
       else element("p",opt.text);
     }
   }
   if(reveal){
     if(!b.results.length)element("p","Too few captions to hold a vote this round.");
     for(const x of b.results)element("p",x.text+" — "+x.name+" ("+x.votes+" votes)");
   }
 }
 if(b.kind==="percentage"){
   if(state.phase==="writing"){
     element("p","Vote privately. Nobody sees the group's result until the reveal.");
     if(answerable){button("Yes",()=>action("respond",1));button("No",()=>action("respond",0));}
   }else if(state.phase==="voting"){
     element("p","Guess the percent who said YES.");
     typed("Your guess, 0–100%",{numeric:true,maxLength:3});
   }
   if(reveal)element("h3",b.actual===null?"No votes submitted":b.actual+"% said YES ("+b.yes+" of "+b.totalVotes+" votes)");
 }
 if(b.kind==="bingo"){
   if(!host){
     if(b.won)element("h3","BINGO! You earned 100 points!");
     const board=element("div");board.className="family-bingo-board";board.setAttribute("aria-label","Your private bingo card");
     b.card.forEach((word,i)=>{
       const marked=b.marks.includes(i),called=word===b.prompt.slice("Called word: ".length);
       const square=button(word+(marked?" ✓":""),()=>action("respond",i),board,!answerable||!called||marked);
       square.className="family-bingo-square";
       square.setAttribute("aria-pressed",marked?"true":"false");
       if(marked)square.classList.add("marked");
       if(called&&!marked)square.classList.add("called");
     });
   }else element("p","The call is shown on each player's private card. Marking is server-verified.");
   if(reveal && b.winners?.length)element("p","New bingo winners: "+b.winners.join(", "));
 }
 if(b.locked && !reveal)element("p","Your response is locked for this phase.");
 if(host && !reveal)element("p","The server tracks every vote and answer. The next phase begins automatically after the deadline or all players finish.");
}
