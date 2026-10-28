import { test, expect } from "@playwright/test";

for(const mode of ["turbo","wave"]){
 test(mode+": QR join, gas, boost, live host race, official finish and mobile layout",async({browser})=>{
   const contexts=[];
   async function page(width){
     const ctx=await browser.newContext({viewport:{width,height:844}});
     contexts.push(ctx);const p=await ctx.newPage();
     await p.goto("http://127.0.0.1:4317");return p;
   }
   const host=await page(1200);
   try{
     await host.locator('[data-game="'+mode+'"] .pick-game-button').click();
     await expect(host.locator("#heading")).toContainText("lobby");
     const invite=await host.locator("#invite-link").inputValue();
     const racers=[];
     for(let i=0;i<3;i++){
       const p=await page(390);
       await p.goto(invite);
       await p.getByLabel("Nickname").fill("Racer "+i);
       await p.getByRole("button",{name:"Join party",exact:true}).click();
       await expect(p.locator("#heading")).toContainText("lobby");
       racers.push(p);
     }
     await host.getByRole("button",{name:"Start match",exact:true}).click();
     await expect(host.locator("#heading")).toContainText("racing");
     const p=racers[0];
     await expect(host.getByRole("img",{name:/live race track, three lanes/})).toBeVisible();
     await expect(p.getByRole("img",{name:/live race track, three lanes/})).toHaveCount(0);
     await p.getByRole("button",{name:"Game info",exact:true}).click();
     await expect(p.getByRole("img",{name:/live race track, three lanes/})).toBeVisible();
     await p.getByRole("button",{name:"Back to game",exact:true}).click();
     await expect(p.getByRole("button",{name:/GAS: OFF/})).toBeVisible();
     await p.getByRole("button",{name:/GAS: OFF/}).click();
     await expect(p.getByRole("button",{name:/GAS: ON/})).toBeVisible();
     await expect(p.getByText(/Distance:/)).not.toContainText("Distance: 0 /");
     await p.waitForTimeout(220);
     await p.getByRole("button",{name:"Lane 3"}).click();
     await expect(p.getByRole("button",{name:"Lane 3"})).toHaveAttribute("aria-pressed","true");
     await p.waitForTimeout(220);
     await p.getByRole("button",{name:"⚡ BOOST!"}).click();
     await expect(p.getByRole("button",{name:/Boost recharging/})).toBeDisabled();
     await expect(host.locator(".arcade-race-host-legend")).toContainText("Racer 0");
     await expect(host.locator(".arcade-race-course circle")).toHaveCount(3);
     expect(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
     host.once("dialog",d=>d.accept());
     await host.getByRole("button",{name:"End race and publish results"}).click();
     await expect(host.locator("#heading")).toContainText("reveal");
     await expect(p.locator(".arcade-race-results p")).toHaveCount(3);
     await p.reload();
     await expect(p.locator(".arcade-race-results p")).toHaveCount(3);
     await host.getByRole("button",{name:"Next",exact:true}).click();
     await expect(host.locator("#heading")).toContainText("finished");
   }finally{await Promise.all(contexts.map(c=>c.close()));}
 });
}
