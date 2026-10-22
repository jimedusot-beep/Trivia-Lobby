import { useEffect, useRef, useState } from "react";

/** Server drafts are owner scoped and use revisions so another device cannot be overwritten. */
export function useAuthorDraft(deckId:number, body:Record<string,unknown>, restore:(value:Record<string,unknown>)=>void){
  const [status,setStatus]=useState("Loading saved draft…"),[ready,setReady]=useState(false);
  const [retry,setRetry]=useState(0);
  const revision=useRef(0),lastSaved=useRef(""),blocked=useRef(false),running=useRef(false);
  const restoreRef=useRef(restore);restoreRef.current=restore;
  const latest=useRef(body);latest.current=body;
  useEffect(()=>{
    let active=true;
    setReady(false);blocked.current=false;
    fetch(`/api/decks/${deckId}/draft`).then(async r=>{if(!r.ok)throw new Error("Cannot load your saved draft");return r.json();}).then(data=>{
      if(!active)return;revision.current=data.revision;
      if(data.body){lastSaved.current=JSON.stringify(data.body);restoreRef.current(data.body);setStatus("Recovered your saved draft");}
      else{lastSaved.current="";setStatus("Drafts save automatically");}
      setReady(true);
    }).catch(e=>{if(active)setStatus(e.message);});
    return()=>{active=false;};
  },[deckId]);
  const serialized=JSON.stringify(body);
  useEffect(()=>{
    if(!ready||blocked.current||serialized===lastSaved.current)return;
    const timer=window.setTimeout(async()=>{
      if(running.current)return;
      running.current=true;setStatus("Saving draft…");
      try{
        const response=await fetch(`/api/decks/${deckId}/draft`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({revision:revision.current,body:JSON.parse(serialized)})});
        if(response.status===409){blocked.current=true;throw new Error("Another device changed this draft. Reload before editing further.");}
        if(!response.ok)throw new Error("Draft save failed. Keep this tab open and retry your edit.");
        const result=await response.json();revision.current=result.revision;lastSaved.current=serialized;setStatus("Draft saved");
      }catch(e){setStatus((e as Error).message);}finally{running.current=false;if(!blocked.current&&JSON.stringify(latest.current)!==serialized)setRetry(n=>n+1);}
    },800);
    return()=>window.clearTimeout(timer);
  },[deckId,ready,serialized,retry]);
  useEffect(()=>{
    const flush=()=>{
      if(!ready||blocked.current||running.current||JSON.stringify(latest.current)===lastSaved.current)return;
      void fetch(`/api/decks/${deckId}/draft`,{method:"PUT",keepalive:true,headers:{"Content-Type":"application/json"},body:JSON.stringify({revision:revision.current,body:latest.current})});
    };
    window.addEventListener("pagehide",flush);return()=>{window.removeEventListener("pagehide",flush);flush();};
  },[deckId,ready]);
  return status;
}
