import { test, expect } from "@playwright/test";

// Real server + independent guests; Spanish labels must never become the
// protocol's action values (canonical 1/0 and integer percentage guesses).
test("Percentage mode accepts Spanish and English votes with identical scores", async ({ browser }) => {
  const contexts = [];
  async function open(viewport) {
    const context = await browser.newContext({viewport});
    contexts.push(context);
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.locator("#status")).toHaveText("Connected.");
    return page;
  }
  try {
    const host = await open({width:1280,height:800});
    await host.locator("#create").click();
    const code = (await host.locator("#heading").innerText()).split(" · ")[0];
    const guests = [];
    for (let n=0;n<3;n++) {
      const page = await open({width:390,height:844});
      if (n===0) await page.locator("#party-language").selectOption("es");
      await page.locator("#code").fill(code);
      await page.locator("#name").fill("Player "+n);
      await page.locator("#join button").click();
      await expect(page.locator("body")).toHaveClass(/phone-controller-active/);
      guests.push(page);
    }
    await host.locator("#mode").selectOption("percentage");
    await host.getByRole("button",{name:"Start match",exact:true}).click();
    await expect(host.locator("#heading")).toContainText("writing");
    await expect(guests[0].locator("#phone-prompt")).toContainText("¿Preferirías vivir cerca del océano");
    await expect(guests[1].locator("#phone-prompt")).toContainText("Would you rather live near the ocean");
    await guests[0].getByRole("button",{name:"Sí",exact:true}).click();  // sends 1
    await guests[1].getByRole("button",{name:"Yes",exact:true}).click(); // sends 1
    await guests[2].getByRole("button",{name:"No",exact:true}).click();  // sends 0
    await expect(host.locator("#heading")).toContainText("voting");
    await expect(guests[0].locator("#phone-prompt")).toContainText("¿Qué porcentaje del grupo votó SÍ?");
    await expect(guests[1].locator("#phone-prompt")).toContainText("What percentage of your group voted YES?");
    for (let n=0;n<3;n++) {
      await guests[n].locator("#family-response").fill("67");
      await guests[n].getByRole("button",{name:n===0?"Confirmar respuesta":"Lock answer",exact:true}).click();
    }
    await expect(host.locator("#heading")).toContainText("reveal");
    await expect(host.locator("#content")).toContainText("67% said YES (2 of 3 votes)");
    await expect(host.locator("#roster li")).toHaveCount(3);
    await expect(host.locator("#roster")).toContainText("100 points");
    await expect(guests[0].locator("html")).toHaveAttribute("lang","es");
    await expect(guests[1].locator("html")).toHaveAttribute("lang","en");
  } finally {
    await Promise.all(contexts.map(context=>context.close()));
  }
});
