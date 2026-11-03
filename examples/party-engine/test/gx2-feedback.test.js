import test from "node:test";
import assert from "node:assert/strict";
import {createFeedbackToolkit,feedbackCues} from "../public/gx2-feedback.js";

function rig({saved=null, storageBlocked=false, locked=false, saveData=false} = {}) {
  const voices=[], writes=[], timers=new Map(), state={sound:"suspended", closed:0, resumes:0};
  const storage={getItem(){if(storageBlocked)throw Error("denied");return saved;},setItem(k,v){if(storageBlocked)throw Error("denied");writes.push(JSON.parse(v));}};
  const context={currentTime:10,destination:{},get state(){return state.sound;},async resume(){state.resumes++;if(!locked)state.sound="running";},async close(){state.closed++;state.sound="closed";},
    createOscillator(){const o={frequency:{setValueAtTime(){}},connect(){return this;},disconnect(){this.disconnected=true;},start(){this.started=true;},stop(){this.stopped=true;},onended:null};voices.push(o);return o;},
    createGain(){return {gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){return this;},disconnect(){this.disconnected=true;}};}};
  const output={textContent:"",dataset:{}};
  const toolkit=createFeedbackToolkit({audioFactory:()=>context,storage,output,saveData:()=>saveData,
    schedule:(fn,ms)=>{const id=Symbol();timers.set(id,{fn,ms});return id;},unschedule:id=>timers.delete(id)});
  return {toolkit,voices,writes,timers,state,output};
}

test("silent by default, unlock requires an explicit call and never plays automatically",async()=>{
  const {toolkit,voices,state}=rig();
  assert.equal(toolkit.state().muted,true);
  assert.deepEqual(toolkit.play("confirm",{eventId:"1"}),{accepted:true,sounded:false});
  assert.equal(voices.length,0);
  assert.equal(state.resumes,0);
  assert.equal(await toolkit.unlock(),true);
  assert.equal(voices.length,0);
  toolkit.setMuted(false);
  assert.deepEqual(toolkit.play("correct",{eventId:"2"}),{accepted:true,sounded:true});
  assert.equal(voices.length,2);
  await toolkit.dispose();
  assert.equal(state.closed,1);
});
test("blocked audio, restricted storage and unsupported cues never interrupt visuals",async()=>{
  const {toolkit,output,voices}=rig({storageBlocked:true,locked:true});
  assert.equal(await toolkit.unlock(),false);
  assert.equal(toolkit.setMuted(false),false);
  assert.equal(toolkit.play("victory").sounded,false);
  assert.equal(output.textContent,"Victory!");
  assert.deepEqual(toolkit.play("unknown"),{accepted:false,sounded:false});
  assert.equal(voices.length,0);
  await toolkit.dispose();
});
test("bounded IDs reject replay, stale rounds and reset after a new round",()=>{
  const {toolkit,output}=rig();
  toolkit.beginRound("room-1");
  assert.equal(toolkit.play("countdown",{eventId:"abc",roundId:"room-1"}).accepted,true);
  assert.equal(toolkit.play("countdown",{eventId:"abc",roundId:"room-1"}).accepted,false);
  assert.equal(toolkit.play("confirm",{eventId:"z",roundId:"old"}).accepted,false);
  assert.equal(toolkit.state().rememberedIds,1);
  assert.equal(toolkit.beginRound("room-2"),true);
  assert.equal(output.textContent,"");
  assert.equal(toolkit.play("countdown",{eventId:"abc",roundId:"room-2"}).accepted,true);
  assert.equal(toolkit.play("confirm",{eventId:""}).accepted,false);
  assert.equal(toolkit.beginRound(""),false);
});
test("event IDs and oscillator counts are bounded, end listeners free voices",async()=>{
  const {toolkit,voices}=rig();
  await toolkit.unlock(); toolkit.setMuted(false); toolkit.beginRound("test");
  for(let n=0;n<300;n++) toolkit.play("confirm",{eventId:"event-"+n});
  assert.equal(toolkit.state().rememberedIds,128);
  assert(toolkit.state().activeVoices<=20);
  for(const v of voices) v.onended?.();
  assert.equal(toolkit.state().activeVoices,0);
  toolkit.play("victory",{eventId:"victory"});
  assert.equal(toolkit.state().activeVoices,4);
  toolkit.beginRound("another");
  assert.equal(toolkit.state().activeVoices,0);
  await toolkit.dispose();
  assert.equal(toolkit.state().rememberedIds,0);
  assert.deepEqual(toolkit.play("correct"),{accepted:false,sounded:false});
});
test("mute, low power, volume and reduced-motion cleanly gate audio and persist",async()=>{
  const {toolkit,voices,writes,output}=rig({saveData:true});
  await toolkit.unlock(); toolkit.setMuted(false);
  toolkit.play("raceBoost",{eventId:"boost"});
  assert.equal(voices.length,0);
  assert.equal(output.dataset.gx2Motion,"off");
  toolkit.setVolume(3);assert.equal(toolkit.state().volume,1);
  assert.equal(toolkit.setVolume(NaN),false);
  toolkit.setLowPower(true);assert.equal(toolkit.state().lowPower,true);
  assert.equal(toolkit.play("incorrect",{eventId:"wrong"}).sounded,false);
  assert(writes.some(s=>s.lowPower===true));
  await toolkit.dispose();
});
test("dispose cancels visual work and active tones without leaks; stored preferences load",async()=>{
  const {toolkit,voices,timers,output,state}=rig({saved:JSON.stringify({muted:false,volume:.65,lowPower:false})});
  assert.equal(toolkit.state().volume,.65);
  await toolkit.unlock();
  toolkit.play("cardFlip",{eventId:"card"});
  assert.equal(voices.length,2);assert.equal(timers.size,1);
  await toolkit.dispose();await toolkit.dispose();
  assert.equal(timers.size,0);assert.equal(output.textContent,"");
  assert.equal(state.closed,1);
  assert(voices.every(v=>v.stopped));
});
test("all original cues have bounded synthesis instructions",()=>{
  assert.deepEqual(Object.keys(feedbackCues),["confirm","countdown","cardFlip","raceBoost","correct","incorrect","victory"]);
  for(const notes of Object.values(feedbackCues)){
    assert(notes.length>=1&&notes.length<=4);
    for(const [hz,start,duration] of notes){assert(hz>=200&&hz<=1200);assert(start>=0&&start<=.5);assert(duration>0&&duration<=.3);}
  }
});
