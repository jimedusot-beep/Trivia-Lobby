import { useState } from "react";
import { Button } from "./ui/button";
type Named={id:string;label:string};
export function MatchingExercise({prompts,matches,value,onChange,disabled}:{
  prompts:{id:string;prompt:string}[];matches:Named[];value:Record<string,string>;
  onChange:(v:Record<string,string>)=>void;disabled:boolean;
}) {
  const [active,setActive]=useState<string|null>(null),[notice,setNotice]=useState("");
  function assign(target:string,label:string){if(disabled)return;onChange({...value,[target]:label});setActive(null);setNotice(`Assigned ${matches.find(m=>m.id===label)?.label??label}`);}
  return <div className="space-y-3">
    <p>Drag a label onto a prompt, or select a label then a target. You can also use the menus.</p>
    <div className="flex flex-wrap gap-2" aria-label="Matching labels">{matches.map(m=><Button key={m.id} variant={active===m.id?"default":"outline"}
      disabled={disabled} draggable={!disabled} aria-pressed={active===m.id} style={{touchAction:"none"}}
      onDragStart={e=>e.dataTransfer.setData("text/plain",m.id)} onClick={()=>setActive(m.id)}
      onPointerDown={e=>{if(e.pointerType==="touch"){setActive(m.id);e.currentTarget.setPointerCapture(e.pointerId);}}}
      onPointerUp={e=>{if(e.pointerType!=="touch")return;const target=document.elementFromPoint(e.clientX,e.clientY)?.closest<HTMLElement>("[data-match-target]");if(target?.dataset.matchTarget)assign(target.dataset.matchTarget,m.id);}}>{m.label}</Button>)}</div>
    {prompts.map(p=><div key={p.id} className="border rounded-lg p-3 space-y-2" data-match-target={p.id}
      onDragOver={e=>{if(!disabled)e.preventDefault();}} onDrop={e=>{e.preventDefault();const label=e.dataTransfer.getData("text/plain");if(matches.some(m=>m.id===label))assign(p.id,label);}}>
      <Button variant="ghost" className="h-auto min-h-11 whitespace-normal text-left" disabled={disabled||!active} onClick={()=>active&&assign(p.id,active)} aria-label={`Assign selected label to ${p.prompt}`}>{p.prompt}</Button>
      <label className="block"><span className="sr-only">{p.prompt}</span><select className="w-full border rounded p-3 bg-background" disabled={disabled}
        value={value[p.id]??""} onChange={e=>assign(p.id,e.target.value)}>
        <option value="">Choose a label</option>{matches.map(m=><option key={m.id} value={m.id}>{m.label}</option>)}
      </select></label>
    </div>)}
    <p role="status" className="sr-only">{notice}</p>
  </div>;
}
