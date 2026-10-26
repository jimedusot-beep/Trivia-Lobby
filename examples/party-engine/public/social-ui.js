// Phone and presenter views for original family games. Never inserts player text as HTML.
export function renderSocial(state, {element,button,action,actor}) {
  const s=state.social, reveal=state.phase==="reveal", host=state.role==="host";
  const title=element("h2",s.prompt);
  title.className="social-prompt";
  element("p",`Round ${state.index+1} of ${s.total} · ${s.received} / ${s.expected} submitted`);
  const draftKey=`social-draft:${state.matchId}:${state.index}:${state.phase}`;
  function textAnswer(label, type="text") {
    if(host || s.locked || reveal) return;
    const wrap=element("div");
    wrap.className="social-entry";
    const caption=element("label",label,wrap);
    const input=element("input",undefined,wrap);
    input.id="social-response";caption.htmlFor=input.id;input.type=type;
    input.autocomplete="off";
    if(type==="number"){input.min="0";input.max="1000000";input.step="1";input.inputMode="numeric";}
    else input.maxLength=80;
    try{input.value=sessionStorage.getItem(draftKey)||"";}catch{}
    input.oninput=()=>{try{sessionStorage.setItem(draftKey,input.value);}catch{}};
    button("Lock answer",()=>{
      const value=type==="number"?input.value===""?NaN:Number(input.value):input.value.trim();
      action("respond",value);
    },wrap);
  }
  if(s.kind==="majority") {
    s.choices.forEach((choice,index)=>{
      if(!host && !s.locked && !reveal) button(choice,()=>action("respond",index));
      else element("p",reveal?`${choice}: ${s.counts[index]} votes (${s.received?Math.round(s.counts[index]/s.received*100):0}%)${s.winners.includes(index)?" · Majority!":""}`:choice);
    });
  }
  if(s.kind==="likely") {
    for(const person of s.candidates){
      if(!host&&!s.locked&&!reveal)
        button(person.name,()=>action("respond",person.id),undefined,person.id===actor());
      else element("p",reveal?`${person.name} · ${s.counts.find(x=>x.id===person.id)?.count??0} votes${s.winners.includes(person.id)?" · Top choice!":""}`:person.name);
    }
  }
  if(s.kind==="closest"){
    textAnswer("Your closest estimate (whole number)","number");
    if(reveal){
      element("p",`Answer: ${s.target} ${s.unit}`);
      element("p",`Closest: ${s.winners.join(", ")||"No estimates submitted"}`);
      for(const g of s.guesses) element("p",`${g.name}: ${g.value}`);
    }
  }
  if(s.kind==="survey"){
    textAnswer("Name one popular answer");
    if(reveal){
      element("h3","Top survey answers");
      for(const answer of s.topAnswers)
        element("p",`${answer.text}: ${answer.points} points · ${answer.count} matches`);
    }
  }
  if(s.kind==="impostor"){
    element("p",`Category: ${s.category}`);
    if(state.phase==="clue"){
      if(!host)element("p",s.role==="impostor"?"SECRET ROLE: You are the impostor. Blend in without knowing the word.":`Secret word: ${s.secretWord}`);
      textAnswer("Your short clue (do not say the word)");
    }
    if(state.phase==="voting"||reveal){
      element("h3","Everyone's clues");
      for(const clue of s.clues)element("p",`${clue.name}: ${clue.text}`);
      if(!reveal){
        element("h3","Who is the impostor?");
        if(!host && !s.locked){
          for(const person of s.candidates)
            button(person.name,()=>action("respond",person.id),undefined,person.id===actor());
        }
      }else{
        element("h3",`Impostor: ${s.impostor} · Word: ${s.secretWord}`);
        for(const p of s.candidates)element("p",`${p.name}: ${s.voteCounts.find(x=>x.id===p.id)?.count||0} votes`);
      }
    }
  }
  if(s.locked && !reveal)element("p","Your response is locked. Awaiting everyone else.");
  if(host && !reveal)element("p","Players answer privately on their phones. The round advances automatically after everyone answers or the timer ends.");
}
