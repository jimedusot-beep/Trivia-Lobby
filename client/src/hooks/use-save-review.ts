import { useRef,useState } from "react";
export function useSaveReview() {
  const [busy,setBusy]=useState(false),[error,setError]=useState("");
  const pending=useRef(false),requestId=useRef(crypto.randomUUID());
  async function save(cardId:number,rating:number) {
    if(pending.current)return false;pending.current=true;setBusy(true);setError("");
    try {
      const response=await fetch("/api/study/review",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({cardId,rating,requestId:requestId.current})});
      if(!response.ok)throw new Error((await response.json().catch(()=>({}))).message??"Review was not saved. Retry before continuing.");
      requestId.current=crypto.randomUUID();return true;
    }catch(e){setError((e as Error).message);return false;}
    finally{pending.current=false;setBusy(false);}
  }
  return {save,busy,error};
}
