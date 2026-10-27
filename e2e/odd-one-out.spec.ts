import { test as base, expect } from "@playwright/test";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";

// An isolated test server preserves the production room-creation rate limit.
const test=base.extend<{}, { oddBaseURL:string }>({
 oddBaseURL:[async({},use)=>{
  const probe=createServer();probe.listen(0,"127.0.0.1");await once(probe,"listening");
  const addr=probe.address();if(!addr||typeof addr==="string")throw new Error("No test port");
  await new Promise<void>((resolve,reject)=>probe.close(error=>error?reject(error):resolve()));
  const baseURL=`http://127.0.0.1:${addr.port}`;
  const app=spawn(process.execPath,["--import","tsx","server/index.ts"],{
   env:{...process.env,PORT:String(addr.port),NODE_ENV:"development"},stdio:["ignore","pipe","pipe"],
  });
  let logs="";const log=(buf:Buffer)=>{logs=(logs+buf.toString()).slice(-4000);};
  app.stdout.on("data",log);app.stderr.on("data",log);const stopped=once(app,"exit");
  try {
   let ready=false;const until=Date.now()+20000;
   while(Date.now()<until&&app.exitCode===null) {
    try{ready=(await fetch(baseURL+"/health/ready",{signal:AbortSignal.timeout(500)})).ok;}catch{}
    if(ready)break;await delay(100);
   }
   if(!ready)throw new Error("Odd One Out test server not ready: "+logs);
   await use(baseURL);
  } finally {
   app.kill("SIGTERM");await Promise.race([stopped,delay(5000)]);
   if(app.exitCode===null&&app.signalCode===null){app.kill("SIGKILL");await stopped;}
  }
 },{scope:"worker"}],
});
test("Odd One Out starter import, shuffled answers, explanation bonus and finish",async({browser,oddBaseURL})=>{
 const hostContext=await browser.newContext({reducedMotion:"reduce"});
 const guestContext=await browser.newContext({viewport:{width:375,height:812},reducedMotion:"reduce"});
 let deckId:number|undefined;
 try {
  const signup=await hostContext.request.post(oddBaseURL+"/api/auth/register",{data:{email:`odd-${crypto.randomUUID()}@example.test`,password:"Mode-test-passphrase-2026"}});
  expect(signup.status()).toBe(201);
  const starter=await hostContext.request.post(oddBaseURL+"/api/odd-one-out/starter");
  expect(starter.status()).toBe(201);
  deckId=(await starter.json()).id;
  const repeat=await hostContext.request.post(oddBaseURL+"/api/odd-one-out/starter");
  expect((await repeat.json()).id).toBe(deckId); // Idempotent import
  const host=await hostContext.newPage();
  await host.goto(oddBaseURL+`/host/${deckId}`);
  const code=host.getByTestId("room-code");
  await expect(code).toHaveText(/^[A-HJ-NP-Z2-9]{6}$/);
  await host.getByLabel("Game mode",{exact:true}).selectOption("odd_one_out");
  await expect(host.getByLabel("Odd One Out round count")).toBeVisible();
  // Consecutive input changes and reconnect must agree with the saved host settings.
  await host.getByLabel("Odd One Out round count").fill("30");
  await host.getByLabel("Shuffle answer positions").check();
  await host.reload();
  await expect(host.getByLabel("Odd One Out round count")).toHaveValue("30");
  await expect(host.getByLabel("Shuffle answer positions")).toBeChecked();
  await host.getByLabel("Odd One Out round count").fill("1");
  await host.getByLabel("Shuffle answer positions").check();

  const guest=await guestContext.newPage();
  await guest.goto(oddBaseURL+"/join");
  await guest.getByLabel("Room Code",{exact:true}).fill((await code.innerText()).trim());
  await guest.getByLabel("Your Name",{exact:true}).fill("Dinner Guest");
  await guest.getByRole("button",{name:"Enter Game",exact:true}).click();
  await expect(guest.getByRole("heading",{name:"Joined lobby"})).toBeVisible();
  await host.getByRole("button",{name:"Start Game",exact:true}).click();
  await expect(host.getByText("Question 1 of 1",{exact:true})).toBeVisible();
  await guest.getByRole("textbox",{name:/Why does it not belong/}).fill("Spinel is not corundum");
  await guest.getByRole("button",{name:/^[A-D]: Spinel$/}).click();
  await expect(guest.getByRole("heading",{name:"Correct!"})).toBeVisible();
  const award=host.getByRole("button",{name:"Approve +1",exact:true});
  await expect(award).toBeVisible();await award.click();
  await host.getByRole("button",{name:"Finish bonus review"}).click();
  await expect(guest.getByText("+2 pts",{exact:true})).toBeVisible();
  await host.getByRole("button",{name:"Show leaderboard",exact:true}).click();
  await guest.getByText("2 pts",{exact:true}).first().waitFor();
  await host.getByRole("button",{name:"Next / Finish",exact:true}).click();
  await expect(guest.getByRole("heading",{name:"Game Over!"})).toBeVisible();
  expect(await guest.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 } finally {
  if(deckId)await hostContext.request.delete(oddBaseURL+`/api/decks/${deckId}`).catch(()=>{});
  await guestContext.close();await hostContext.close();
 }
});
