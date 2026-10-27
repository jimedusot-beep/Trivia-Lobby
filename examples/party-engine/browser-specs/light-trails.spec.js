import { test, expect } from "@playwright/test";

test("Light Trails Royale uses existing QR room, private phone turning and overhead TV", async({browser})=>{
  test.setTimeout(60000);
  const hostContext=await browser.newContext({viewport:{width:1280,height:850}});
  const aContext=await browser.newContext({viewport:{width:375,height:812}});
  const bContext=await browser.newContext({viewport:{width:375,height:812}});
  try{
    const host=await hostContext.newPage(),a=await aContext.newPage(),b=await bContext.newPage();
    await host.goto("/");
    await host.getByRole("button",{name:"Host Light Trails Royale, 2–20 players"}).click();
    const url=await host.locator("#invite-link").inputValue();
    for(const [page,name]of [[a,"Trail Ada"],[b,"Trail Ben"]]){
      await page.goto(url);
      await page.getByLabel("Nickname",{exact:true}).fill(name);
      await page.getByRole("button",{name:"Join party"}).click();
      await expect(page.locator("#heading")).toContainText("lobby");
    }
    await host.getByRole("button",{name:"Start match"}).click();
    await expect(host.locator(".trails-canvas")).toBeVisible({timeout:10000});
    await expect(host.locator(".trails-leaderboard li")).toHaveCount(2);
    await expect(a.locator(".trails-controls button")).toHaveCount(2);
    await expect(b.locator(".trails-controls button")).toHaveCount(2);
    await expect(a.locator(".trails-canvas")).toHaveCount(0);
    await a.getByRole("button",{name:"↶ LEFT"}).click();
    await expect(a.locator(".trails-status")).toContainText(/tiles survived|Trail ended/, {timeout:5000});
    await expect(host.locator(".trails-leaderboard")).toContainText("Trail Ada");
    expect(await a.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    await expect(host.locator(".trails-results li")).toHaveCount(2,{timeout:15000});
    await host.getByRole("button",{name:"Next",exact:true}).click();
    await expect(host.locator(".trails-canvas")).toBeVisible({timeout:10000});
    await expect(a.getByRole("button",{name:"↶ LEFT"})).toBeVisible();
  }finally{await Promise.all([hostContext.close(),aContext.close(),bContext.close()]);}
});
