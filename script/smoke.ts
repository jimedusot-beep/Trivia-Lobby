import { WebSocket } from "ws";
const origin=new URL(process.env.SMOKE_URL??"http://127.0.0.1:5000");
for(const path of ["/health/live","/health/ready"]){
 const response=await fetch(new URL(path,origin),{signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw new Error(path+" failed with "+response.status);
}
const socketUrl=new URL("/ws",origin);socketUrl.protocol=origin.protocol==="https:"?"wss:":"ws:";
await new Promise<void>((resolve,reject)=>{
 const ws=new WebSocket(socketUrl,{origin:origin.origin});
 const timer=setTimeout(()=>{ws.terminate();reject(new Error("WebSocket smoke timeout"));},10000);
 ws.once("open",()=>ws.send(JSON.stringify({v:1,type:"start_game",payload:{}})));
 ws.once("message",raw=>{try{const data=JSON.parse(raw.toString());if(data.type!=="error")throw new Error("Unexpected smoke response");clearTimeout(timer);ws.close();resolve();}catch(e){reject(e);}});
 ws.once("error",e=>{clearTimeout(timer);reject(e);});
});
console.log("HTTP, database readiness and WebSocket smoke checks passed");
