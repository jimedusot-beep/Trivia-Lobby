// SPDX-License-Identifier: AGPL-3.0-or-later
// Original screen-relative steering. Sensor samples stay on this device.
const radians = Math.PI / 180;
export function screenRoll(beta, gamma, angle = 0) {
  if (![beta, gamma, angle].every(Number.isFinite) || Math.abs(beta)>180 || Math.abs(gamma)>90) return null;
  const b=beta*radians,g=gamma*radians,a=angle*radians;
  const x=Math.cos(b)*Math.sin(g), y=-Math.sin(b);
  const right=x*Math.cos(a)-y*Math.sin(a), down=-x*Math.sin(a)-y*Math.cos(a);
  if (Math.hypot(right,down)<0.35) return null;
  return Math.atan2(right,down)/radians;
}
export function tiltValue(roll, neutral) {
  const delta=((roll-neutral+540)%360)-180;
  return Math.sign(delta)*Math.min(1,Math.max(0,(Math.abs(delta)-3)/21));
}
export function createTiltSteering({onState}) {
  let paused=false;
  let wanted=false,active=false,disposed=false,epoch=0,timer,neutral=null,value=0,last=0,lastFilter=0,axis;
  const now=()=>performance.now();
  const blocked=()=>paused || document.hidden || !!document.querySelector('dialog[open]');
  const angle=()=>screen.orientation?.angle ?? window.orientation ?? 0;
  const announce=(state)=>{if(!disposed) onState(state);};
  function reset(){neutral=null;value=0;last=0;lastFilter=0;}
  function stop(message='Touch steering'){
    ++epoch;wanted=false;active=false;clearTimeout(timer);window.removeEventListener('deviceorientation',sample);reset();announce({mode:'touch',message,value:0});
  }
  function sample(event){
    if(!wanted || disposed || blocked())return;
    const nextAxis=angle();if(axis!==nextAxis){reset();axis=nextAxis;}
    const roll=screenRoll(event.beta,event.gamma,nextAxis);
    if(roll===null){reset();if(active)announce({mode:'tilt',message:'Hold phone upright',value:0});return;}
    const time=now();
    if(neutral===null){neutral=roll;value=0;lastFilter=time;}
    else {const gain=1-Math.exp(-Math.min(100,time-lastFilter)/80);value+=(tiltValue(roll,neutral)-value)*gain;lastFilter=time;}
    last=time;active=true;clearTimeout(timer);announce({mode:'tilt',message:value<-.08?'Tilt left':value>.08?'Tilt right':'Centered',value});
  }
  async function enable(){
    if(disposed || wanted)return;
    const token=++epoch;wanted=true;reset();announce({mode:'pending',message:'Hold phone comfortably upright…',value:0});
    try{
      const Sensor=window.DeviceOrientationEvent;
      if(!window.isSecureContext || !Sensor){stop('Tilt unavailable — use touch');return;}
      // Calling directly in the click handler preserves transient user activation.
      const permission=typeof Sensor.requestPermission==='function' ? await Sensor.requestPermission() : 'granted';
      if(disposed || token!==epoch)return;
      if(permission!=='granted'){stop('Motion denied — use touch');return;}
      axis=angle();window.addEventListener('deviceorientation',sample);
      timer=setTimeout(()=>stop('No motion data — use touch'),3000);
    }catch{if(!disposed && token===epoch)stop('Tilt unavailable — use touch');}
  }
  function read(){
    if(!active)return 0;
    if(axis!==angle()){axis=angle();reset();announce({mode:'tilt',message:'Hold upright to recenter',value:0});return 0;}
    if(blocked() || now()-last>700){reset();announce({mode:'tilt',message:'Hold upright to recenter',value:0});return 0;}
    return Math.max(-1,Math.min(1,value));
  }
  return {enable,read,reset,stop,pause(){paused=true;reset();},resume(){paused=false;reset();},get active(){return active;},dispose(){disposed=true;++epoch;wanted=false;clearTimeout(timer);window.removeEventListener('deviceorientation',sample);reset();}};
}
