import WebSocket from "ws";
const base=process.env.SMOKE_BASE_URL;
if(!base)throw new Error("SMOKE_BASE_URL required");
const url=new URL(base);if(!["http:","https:"].includes(url.protocol))throw new Error("HTTP(S) URL required");
const health=await fetch(new URL("/api/health",url),{signal:AbortSignal.timeout(10_000)});
if(!health.ok||(await health.json()).database!=="ok")throw new Error("HTTP/database smoke failed");
const privateDecks=await fetch(new URL("/api/decks",url),{signal:AbortSignal.timeout(10_000)});
if(privateDecks.status!==401)throw new Error("Anonymous deck access must be denied");
const wsUrl=new URL("/ws",url);wsUrl.protocol=url.protocol==="https:"?"wss:":"ws:";
await new Promise<void>((resolve,reject)=>{
  const ws=new WebSocket(wsUrl,{origin:url.origin});const timer=setTimeout(()=>{ws.terminate();reject(new Error("WebSocket smoke timeout"));},10_000);
  ws.on("error",reject);ws.on("open",()=>ws.send(JSON.stringify({v:99,type:"start_game",payload:{}})));
  ws.on("message",raw=>{const msg=JSON.parse(raw.toString());if(msg.type!=="error"){reject(new Error("Invalid schema response"));return;}clearTimeout(timer);ws.close();resolve();});
});
console.log("HTTP, database, private-access and WebSocket schema smoke passed");
