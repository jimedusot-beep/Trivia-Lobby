import { test, expect } from "@playwright/test";

test("Game Night Championship persists when a family switches games in one QR room", async ({ browser }) => {
  test.setTimeout(105000);
  const hostContext = await browser.newContext({viewport:{width:1280,height:850}});
  const mobileContext = await browser.newContext({viewport:{width:375,height:812}});
  const otherContext = await browser.newContext({viewport:{width:375,height:812}});
  try {
    const host = await hostContext.newPage();
    const winner = await mobileContext.newPage();
    const friend = await otherContext.newPage();
    await host.goto("/");
    await host.getByRole("button",{name:"Host Tap Dash, 2–20 players"}).click();
    const link=await host.locator("#invite-link").inputValue();
    for (const [page,name] of [[winner,"Champion Ava"],[friend,"Runner Ben"]]) {
      await page.goto(link);
      await page.getByLabel("Nickname",{exact:true}).fill(name);
      await page.getByRole("button",{name:"Join party"}).click();
      await expect(page.locator("#heading")).toContainText("lobby");
    }
    await host.getByRole("button",{name:"Start match"}).click();
    for (let heat=0;heat<3;heat++) {
      const tap = winner.getByRole("button",{name:"Tap to race"});
      await expect(tap).toBeVisible({timeout:10000});
      await tap.click();
      await expect(host.locator(".tap-results li")).toHaveCount(2,{timeout:18000});
      await host.getByRole("button",{name:"Next",exact:true}).click();
    }
    await expect(host.locator("#heading")).toContainText("finished");
    const standings=host.locator("#championship");
    await expect(standings.getByRole("heading",{name:"Game Night Championship"})).toBeVisible();
    await expect(standings).toContainText("1 completed games");
    await expect(standings).toContainText("Champion Ava");
    await expect(standings).toContainText("100 points");
    await expect(winner.locator("#championship")).toContainText("1 completed games");
    await host.getByRole("button",{name:"Return to same party"}).click();
    await expect(host.locator("#heading")).toContainText("lobby");
    await expect(host.locator("#championship")).toContainText("1 completed games");
    await host.getByLabel("Game mode").selectOption("race");
    await host.getByRole("button",{name:"Start match"}).click();
    await expect(host.locator("#heading")).toContainText(/countdown|playing/);
    await expect(host.locator("#championship")).toContainText("1 completed games");
    await expect(host.locator("#championship")).toContainText("Champion Ava");
    await expect(winner.locator("#championship")).toContainText("100 points");
  } finally {
    await Promise.all([hostContext.close(),mobileContext.close(),otherContext.close()]);
  }
});
