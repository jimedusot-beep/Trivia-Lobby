import { useEffect, useRef, useState } from "react";

/** Server drafts follow the account across devices. Revision checks prevent lost updates. */
export function useAuthorDraft(deckId:number, payload:Record<string,unknown>, restore:(value:any)=>void) {
  const [ready,setReady]=useState(false),[status,setStatus]=useState("Loading draft…");
  const revision=useRef(0), serialized=JSON.stringify(payload), last=useRef(""), restoreRef=useRef(restore);
  restoreRef.current=restore;
  const sequence=useRef(Promise.resolve());
  useEffect(()=>{
    let active=true;
    fetch(`/api/decks/${deckId}/draft`).then(async r=>{if(!r.ok)throw new Error("Draft recovery unavailable");return r.json();})
      .then(draft=>{if(!active)return;revision.current=draft?.revision??0;
        if(draft){last.current=JSON.stringify(draft.payload);restoreRef.current(draft.payload);setStatus("Recovered your saved draft");}
        else{last.current=serialized;setStatus("Draft recovery ready");}setReady(true);
      }).catch(()=>{if(active){setStatus("Draft recovery unavailable. Keep this page open until your question is saved.");setReady(false);}});
    return()=>{active=false;};
  },[deckId]);
  useEffect(()=>{
    if(!ready || serialized===last.current || revision.current<0)return;
    setStatus("Saving draft…");
    const timer=setTimeout(()=>{
      sequence.current=sequence.current.then(async()=>{
        const response=await fetch(`/api/decks/${deckId}/draft`,{method:"PUT",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({payload:JSON.parse(serialized),revision:revision.current})});
        if(response.status===409){revision.current=-1;throw new Error("A newer draft exists on another device. Reload before editing further.");}
        if(!response.ok)throw new Error("Draft save failed. Your form is still open; retry by editing or save the question.");
        const draft=await response.json();revision.current=draft.revision;last.current=serialized;setStatus("Draft saved");
      }).catch(e=>setStatus(e.message));
    },650);
    return()=>clearTimeout(timer);
  },[deckId,ready,serialized]);
  return {status,ready};
}
