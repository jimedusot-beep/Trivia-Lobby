import { test, expect } from "@playwright/test";

test("Forbidden Word Frenzy uses one QR room and keeps clue cards private to two phones", async ({browser}) => {
  test.setTimeout(55000);
  const contexts=await Promise.all([1280,375,375,375].map(width=>browser.newContext({viewport:{width,height:850}})));
  try {
    const [host,giver,referee,guesser]=await Promise.all(contexts.map(c=>c.newPage()));
    await host.goto("/");
    await host.getByRole("button",{name:"Host Forbidden Word Frenzy, 3–20 players"}).click();
    await expect(host.locator("#heading")).toContainText("lobby");
    const join=await host.locator("#invite-link").inputValue();
    for (const [page,name] of [[giver,"Giver Alice"],[referee,"Referee Ben"],[guesser,"Guessing Cat"]]) {
      await page.goto(join);
      await page.getByLabel("Nickname",{exact:true}).fill(name);
      await page.getByRole("button",{name:"Join party"}).click();
      await expect(page.locator("#heading")).toContainText("lobby");
    }
    await host.getByRole("button",{name:"Start match"}).click();
    await expect(giver.locator(".forbidden-secret h3")).toBeVisible({timeout:10000});
    await expect(referee.locator(".forbidden-secret h3")).toBeVisible();
    const word=await giver.locator(".forbidden-secret h3").innerText();
    expect(word.trim().length).toBeGreaterThan(0);
    await expect(host.locator(".forbidden-secret")).toHaveCount(0);
    await expect(guesser.locator(".forbidden-secret")).toHaveCount(0);
    await expect(host.locator("#content")).not.toContainText(word);
    await expect(guesser.locator("#content")).not.toContainText(word);
    await expect(giver.getByRole("button",{name:/Correct!.*20/})).toHaveCount(0);
    await referee.getByRole("button",{name:/Correct!.*20/}).click();
    await expect(host.locator("#roster")).toContainText("Giver Alice: 20 points");
    await expect(giver.locator(".forbidden-secret h3")).toBeVisible();
    expect(await referee.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    await referee.reload();
    await expect(referee.getByRole("button",{name:/Correct!.*20/})).toBeVisible({timeout:8000});
  } finally {
    await Promise.all(contexts.map(c=>c.close()));
  }
});
