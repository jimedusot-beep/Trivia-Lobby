import { test, expect } from "@playwright/test";
async function group(browser) {
 const contexts=[];
 async function page(mobile) {
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:800}});
  contexts.push(context);
  const p=await context.newPage();await p.goto("http://127.0.0.1:4317");
  await expect(p.locator("#status")).toHaveText("Connected.");
  return p;
 }
 const host=await page(false);await host.getByRole("button",{name:"Create host screen"}).click();
 await expect(host.locator("#heading")).toContainText("lobby");
 const code=(await host.locator("#heading").innerText()).split(" · ")[0],players=[];
 for(let i=0;i<3;i++){
  const p=await page(true);
  await p.getByLabel("Party code").fill(code);
  await p.getByLabel("Nickname").fill("Guest "+i);
  await p.getByRole("button",{name:"Join party"}).click();
  await expect(p.locator("#heading")).toContainText("lobby");
  players.push(p);
 }
 return {host,players,close:()=>Promise.all(contexts.map(c=>c.close()))};
}
for(const mode of ["majority","likely","closest","survey","impostor"]) {
 test(`${mode} accepts phone inputs, scores on the server and reveals results`,async({browser})=>{
  const f=await group(browser);
  try{
   await f.host.getByLabel("Game mode").selectOption(mode);
   await f.host.getByRole("button",{name:"Start match"}).click();
   const opening=mode==="impostor"?"clue":"question";
   await expect(f.host.locator("#heading")).toContainText(opening);
   for(let i=0;i<3;i++){
    const p=f.players[i];
    await expect(p.locator("#heading")).toContainText(opening);
    if(["majority","likely"].includes(mode))await p.locator(".phone-surface button:enabled").first().click();
    else {
     await p.locator("#social-response").fill(mode==="closest"?"88":mode==="survey"?"Passport":"A nice clue");
     await p.getByRole("button",{name:"Lock answer"}).click();
    }
   }
   if(mode==="impostor"){
    await expect(f.host.locator("#heading")).toContainText("voting");
    await expect(f.host.locator("#content")).not.toContainText("Word: Pancakes");
    for(const p of f.players){
     await expect(p.locator("#heading")).toContainText("voting");
     await p.locator(".phone-surface button:enabled").first().click();
    }
   }
   await expect(f.host.locator("#heading")).toContainText("reveal");
   if(mode==="majority")await expect(f.host.locator("#content")).toContainText("100%");
   if(mode==="likely")await expect(f.host.locator("#content")).toContainText("Top choice!");
   if(mode==="closest")await expect(f.host.locator("#content")).toContainText("Answer: 88 keys");
   if(mode==="survey")await expect(f.host.locator("#content")).toContainText("Passport: 100 points");
   if(mode==="impostor")await expect(f.host.locator("#content")).toContainText("Impostor:");
   await expect(f.host.locator("#roster li")).toHaveCount(3);
   await f.host.getByRole("button",{name:"Next"}).click();
   await expect(f.host.locator("#heading")).toContainText(mode==="impostor"?"clue":"question");
  }finally{await f.close();}
 });
}
