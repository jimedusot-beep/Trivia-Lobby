// Original Light Trails Royale shared TV/phone UI. Physics and scoring are server-only.
let active=null;
const COLORS=["#ff5f7c","#25caaa","#edb932","#7595fa","#bf82fa","#ff8a45","#38bfe0","#9edc46","#ff86d2","#a7a1fc"];
const add=(tag,value,parent,cls)=>{
  const node=document.createElement(tag);
  if(value!==undefined)node.textContent=value;
  if(cls)node.className=cls;
  parent.append(node);
  return node;
};
const paint=(index)=>COLORS[index%COLORS.length];
export function disposeTrails(){active=null;document.body.classList.remove("trails-host","trails-phone");}
export function receiveTrailsFrame(frame){
  if(!active||active.state.matchId!==frame.matchId||active.state.index!==frame.heat)return;
  active.frame(frame);
}
export function updateTrailsState(state){
  if(!active||state.phase!=="playing"||state.pack?.kind!=="trails"||
    active.key!==`${state.matchId}:${state.index}`)return false;
  active.state=state;active.frame(state.pack);return true;
}
export function renderTrails(state,{sendInput}) {
  disposeTrails();
  const root=add("section",undefined,document.getElementById("content"),"trails-game");
  add("h2",state.phase==="playing"?"⚡ Light Trails Royale":"🏆 Light Trails results",root);
  add("p",`Heat ${state.index+1} of ${state.pack.totalHeats}`,root,"trails-round");
  if(state.phase!=="playing"){
    const results=add("ol",undefined,root,"trails-results");
    for(const result of state.pack.results||[]){
      const row=add("li",undefined,results);
      add("strong",`#${result.place} ${result.name}`,row);
      add("span",`${result.steps} steps · +${result.points} points`,row);
    }
    add("p","Scores carry across the three heats. The Game Night Championship adds normalized points after the completed match.",root);
    return;
  }
  const host=state.role==="host";
  document.body.classList.add(host?"trails-host":"trails-phone");
  const clock=add("strong","45.0s",root,"trails-clock");
  const alive=add("p","20 riders",root,"trails-alive");
  const current=active={key:`${state.matchId}:${state.index}`,state,frame(){}};
  if(host){
    add("p","Everyone steers with their phone. Avoid the glowing trails and the arena walls.",root);
    const canvas=add("canvas",undefined,root,"trails-canvas");
    canvas.width=672;canvas.height=448;canvas.setAttribute("role","img");
    canvas.setAttribute("aria-label","Light Trails arena; rider positions and status are also listed below");
    const c=canvas.getContext("2d");
    const leaderboard=add("ol",undefined,root,"trails-leaderboard");
    current.frame=frame=>{
      clock.textContent=`${(frame.remainingMs/1000).toFixed(1)}s`;
      alive.textContent=`${frame.alive} surviving riders`;
      if(!frame.riders||!c)return;
      c.fillStyle="#16213e";c.fillRect(0,0,canvas.width,canvas.height);
      c.strokeStyle="#2a3959";c.lineWidth=1;
      for(let x=0;x<=48;x+=4){c.beginPath();c.moveTo(x*14,0);c.lineTo(x*14,448);c.stroke();}
      for(let y=0;y<=32;y+=4){c.beginPath();c.moveTo(0,y*14);c.lineTo(672,y*14);c.stroke();}
      leaderboard.replaceChildren();
      for(const r of frame.riders){
        const color=paint(r.slot);
        c.fillStyle=color;
        for(const pos of r.trail)c.fillRect(pos[0]*14+1,pos[1]*14+1,12,12);
        const head=r.trail[r.trail.length-1];
        if(r.alive&&head){c.strokeStyle="#fff";c.lineWidth=2.5;c.strokeRect(head[0]*14+.5,head[1]*14+.5,13,13);}
        const row=add("li",undefined,leaderboard);
        const swatch=add("span","●",row);swatch.style.color=color;swatch.setAttribute("aria-hidden","true");
        add("span",r.name,row);
        add("strong",r.alive?"Racing":`${r.trail.length-1} steps`,row);
      }
    };
  }else{
    add("p","Your trail moves forward automatically. Tap LEFT or RIGHT for one 90° turn. Don't crash!",root,"trails-help");
    const status=add("strong","Ready…",root,"trails-status");
    const controls=add("div",undefined,root,"trails-controls");
    let seq=Math.max(0,(state.pack.own?.seq??-1)+1),last=-Infinity;
    const createTurn=(direction,title)=>{
      const button=add("button",title,controls,"trails-turn");
      button.type="button";
      button.addEventListener("click",()=>{
        const now=performance.now();
        if(active!==current||current.state.phase!=="playing"||now-last<85)return;
        if(button.disabled)return;
        last=now;
        sendInput({v:1,type:"trails_input",matchId:current.state.matchId,heat:current.state.index,seq:seq++,turn:direction});
      });
      return button;
    };
    const left=createTurn(-1,"↶ LEFT");
    const right=createTurn(1,"RIGHT ↷");
    current.frame=frame=>{
      clock.textContent=`${(frame.remainingMs/1000).toFixed(1)}s`;
      alive.textContent=`${frame.alive} surviving riders`;
      if(frame.own){
        seq=Math.max(seq,frame.own.seq+1);
        status.textContent=frame.own.alive?`${frame.own.steps} tiles survived`:"Trail ended! Watch the arena.";
        left.disabled=right.disabled=!frame.own.alive;
      }
    };
  }
  current.frame(state.pack);
}
