import { test, expect } from "@playwright/test";

async function room(browser){
 const contexts=[];
 const page=async mobile=>{
   const ctx=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1200,height:850}});
   contexts.push(ctx);const p=await ctx.newPage();await p.goto("http://127.0.0.1:4317");
   await expect(p.locator("#status")).toHaveText("Connected.");return p;
 };
 const host=await page(false);
 await host.getByRole("button",{name:"Create host screen"}).click();
 const code=(await host.locator("#heading").innerText()).split(" · ")[0];
 const players=[];
 for(let i=0;i<3;i++){
   const p=await page(true);
   await p.getByLabel("Party code").fill(code);
   await p.getByLabel("Nickname").fill("Tester "+i);
   await p.getByRole("button",{name:"Join party"}).click();
   await expect(p.locator("#heading")).toContainText("lobby");
   players.push(p);
 }
 await expect(host.locator("#roster li")).toHaveCount(3);
 return {host,players,close:()=>Promise.all(contexts.map(c=>c.close()))};
}
for(const mode of ["bracket","timeline","caption","category","percentage","bingo"]){
 test("Family game "+mode+" works on 3 phone views with a QR guest lobby",async({browser})=>{
   const f=await room(browser);
   try{
     const {host,players}=f;
     await host.getByLabel("Game mode").selectOption(mode);
     await host.getByRole("button",{name:"Start match",exact:true}).click();
     const phase=["caption","percentage"].includes(mode)?"writing":"question";
     await expect(host.locator("#heading")).toContainText(phase);
     if(mode==="bingo"){
       for(const p of players){
         await expect(p.locator(".family-bingo-square")).toHaveCount(16);
         const n=await p.locator(".family-bingo-square.called").count();
         expect(n).toBeLessThanOrEqual(1);
       }
       await expect(host.locator("#content")).toContainText("Called word:");
       await expect(host.locator(".family-bingo-square")).toHaveCount(0);
       return;
     }
     for(let i=0;i<3;i++){
       const p=players[i];
       await expect(p.locator("#heading")).toContainText(phase);
       if(mode==="bracket")await p.locator("#content button:enabled").first().click();
       if(mode==="timeline"){
         for(let index=0;index<4;index++)await p.locator("#timeline-"+index).selectOption(String(index));
         await p.getByRole("button",{name:"Submit order"}).click();
       }
       if(mode==="category"){
         await p.getByLabel("Your valid category answer").fill("Peach");
         await p.getByRole("button",{name:"Lock answer"}).click();
       }
       if(mode==="caption"){
         await p.getByLabel("Your caption (80 characters maximum)").fill("Caption "+i);
         await p.getByRole("button",{name:"Lock answer"}).click();
       }
       if(mode==="percentage")await p.getByRole("button",{name:"Yes",exact:true}).click();
     }
     if(mode==="caption" || mode==="percentage"){
       await expect(host.locator("#heading")).toContainText("voting");
       for(let i=0;i<3;i++){
         const p=players[i];
         if(mode==="caption")await p.getByRole("button",{name:"Caption "+((i+1)%3)}).click();
         else {
           await p.getByLabel("Your guess, 0–100%").fill("100");
           await p.getByRole("button",{name:"Lock answer"}).click();
         }
       }
     }
     await expect(host.locator("#heading")).toContainText("reveal");
     if(mode==="bracket")await expect(host.locator("#content")).toContainText("Winner:");
     if(mode==="timeline")await expect(host.locator("#content")).toContainText("Correct order");
     if(mode==="category")await expect(host.locator("#content")).toContainText("Peach");
     if(mode==="caption")await expect(host.locator("#content")).toContainText("votes");
     if(mode==="percentage")await expect(host.locator("#content")).toContainText("100% said YES");
     await host.getByRole("button",{name:"Next",exact:true}).click();
     await expect(host.locator("#heading")).toContainText(phase);
   }finally{await f.close();}
 });
}
