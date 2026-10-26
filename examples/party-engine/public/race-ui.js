// Original shared kart/jet-ski SVG race view; no copyrighted console assets.
// The WebSocket server owns physics, finish times and points. Labels use textContent.
export function renderRace(state,{element,button,action,actor}){
  const race=state.race,host=state.role==="host",me=race.me;
  const heading=element("h2",race.kind==="wave"?"🌊 Wave Sprint":"🏎️ Turbo Circuit");
  heading.className="race-heading";
  element("p",host?"Watch the group race live. Everyone steers and boosts on their own phone.":"Choose a lane, turn GAS on, and time your BOOST!");
  const holder=element("section");holder.className="race-layout";
  const ns="http://www.w3.org/2000/svg";
  const track=document.createElementNS(ns,"svg");
  track.setAttribute("viewBox","0 0 340 436");
  track.setAttribute("role","img");
  track.setAttribute("aria-label",race.label+" live race track, three lanes");
  track.classList.add("race-course");
  function draw(tag,attrs={},label,container=track){
    const item=document.createElementNS(ns,tag);
    for(const [key,value] of Object.entries(attrs))item.setAttribute(key,String(value));
    if(label!==undefined)item.textContent=label;
    container.append(item);return item;
  }
  draw("rect",{x:10,y:6,width:320,height:424,rx:17,class:race.kind==="wave"?"race-water":"race-road"});
  for(let i=0;i<4;i++)draw("line",{x1:30+i*93,y1:12,x2:30+i*93,y2:420,"stroke-width":i===0||i===3?4:2,class:"race-lane-line"});
  draw("rect",{x:30,y:23,width:279,height:14,class:"race-finish"});
  draw("text",{x:170,y:17,"text-anchor":"middle",class:"race-track-label"},"FINISH");
  draw("text",{x:170,y:426,"text-anchor":"middle",class:"race-track-label"},"START");
  for(const obstacle of race.obstacles){
    const x=30+obstacle.lane*93+46,y=403-obstacle.at/race.distance*363;
    draw("text",{x,y,"text-anchor":"middle",class:"race-hazard"},race.kind==="wave"?"〰":"▲");
  }
  const self=actor();
  for(const racer of race.positions){
    const x=30+racer.lane*93+46+((racer.index%5)-2)*5;
    const y=403-racer.distance/race.distance*363+((racer.index%4)-1.5)*4;
    const own=racer.id===self,group=draw("g",{class:"race-racer"+(own?" race-self":"")});
    draw("circle",{cx:x,cy:y,r:own?12:9,fill:own?"#ffe061":racer.connected?"#f47b72":"#87919a",stroke:"#17234a","stroke-width":own?3:1},undefined,group);
    draw("text",{x,y:y+4,"text-anchor":"middle",class:"race-number"},racer.index+1,group);
    draw("title",{},racer.name+" — "+Math.round(racer.distance)+" meters",group);
  }
  holder.append(track);
  if(!host){
    const controls=element("div",undefined,holder);controls.className="race-controls";
    if(me){
      element("p","Distance: "+me.distance+" / "+race.distance+" m · Speed "+me.speed,controls);
      const laneRow=element("div",undefined,controls);laneRow.className="race-lane-actions";
      for(let i=0;i<3;i++){
        const lane=button("Lane "+(i+1),()=>action("play",{action:"drive",lane:i,gas:me.gas,boost:false}),laneRow,me.finished||me.lane===i||state.phase!=="racing");
        lane.setAttribute("aria-pressed",String(me.lane===i));
      }
      button(me.gas?"GAS: ON — tap to coast":"GAS: OFF — tap to accelerate",()=>action("play",{action:"drive",lane:me.lane,gas:!me.gas,boost:false}),controls,me.finished||state.phase!=="racing");
      const boost=button(me.boostReady?"⚡ BOOST!":"Boost recharging ("+Math.ceil(me.boostWaitMs/1000)+"s)",()=>action("play",{action:"drive",lane:me.lane,gas:true,boost:true}),controls,me.finished||!me.boostReady||state.phase!=="racing");
      boost.className="race-boost";
      if(me.finished)element("p","Finished! Watch everyone else cross the line.",controls);
    }
  }else{
    const status=element("div",undefined,holder);status.className="race-host-legend";
    element("h3","Race positions",status);
    [...race.positions].sort((a,b)=>b.distance-a.distance).forEach((r,i)=>element("p",(i+1)+". "+r.name+" · "+Math.round(r.distance)+" m"+(r.finished?" 🏁":""),status));
    if(state.phase==="racing")button("End race and publish results",()=>{
      if(confirm("End this race now? Rankings will use the distance already travelled."))action("play",{action:"end-match"});
    },status);
  }
  if(race.results){
    const scores=element("section");scores.className="race-results";
    element("h3","Official race results",scores);
    for(const result of race.results){
      const time=result.finished?(result.timeMs/1000).toFixed(1)+"s":result.distance+" m";
      element("p",result.rank+". "+result.name+" — "+time+" · "+(state.players.find(p=>p.id===result.id)?.score??0)+" points",scores);
    }
  }
}
