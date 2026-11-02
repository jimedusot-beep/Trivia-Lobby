import {test, expect} from "@playwright/test";

// A language preference is per browser, not part of the room protocol. Rejoining
// with a saved credential must not change the player's identity or replay points.
test("Spanish phone retains language and one quiz score after reload/reconnect", async ({browser}) => {
  const contexts=[];
  const makePage=async mobile => {
    const context=await browser.newContext({viewport: mobile ? {width:390,height:844} : {width:1280,height:800}});
    contexts.push(context);
    const page=await context.newPage();
    await page.goto("/");
    await expect(page.locator("#status")).toHaveText("Connected.");
    return page;
  };
  try {
    const host=await makePage(false);
    await host.locator("#create").click();
    await expect(host.locator("#heading")).toContainText("lobby");
    const code=(await host.locator("#heading").innerText()).split(" · ")[0];
    const guests=[];
    for(const [index,name] of ["Español","English","Guest"].entries()) {
      const page=await makePage(true);
      if(index===0) await page.locator("#party-language").selectOption("es");
      await page.locator("#code").fill(code);
      await page.locator("#name").fill(name);
      await page.locator("#join button").click();
      await expect(page.locator("body")).toHaveClass(/phone-controller-active/);
      guests.push(page);
    }
    const [spanish,english,other]=guests;
    await host.locator("#mode").selectOption("quiz");
    await host.getByRole("button",{name:"Start match",exact:true}).click();
    await expect(spanish.locator("#phone-prompt")).toContainText("¿Qué figura");
    await spanish.getByRole("button",{name:"Triángulo",exact:true}).click();
    await expect(host.locator("#content")).toContainText("1 answers received.");

    await spanish.reload();
    await expect(spanish.locator("#status")).toHaveText("Reconectado.");
    await expect(spanish.locator("html")).toHaveAttribute("lang","es");
    await expect(spanish.locator("#phone-prompt")).toContainText("¿Qué figura");
    await expect(english.locator("html")).toHaveAttribute("lang","en");
    await expect(host.locator("#roster li")).toHaveCount(3);
    await expect(host.locator("#content")).toContainText("1 answers received.");

    await english.getByRole("button",{name:"Triangle",exact:true}).click();
    await other.getByRole("button",{name:"Triangle",exact:true}).click();
    await expect(host.locator("#heading")).toContainText("reveal");
    for(const name of ["Español","English","Guest"])
      await expect(host.locator("#roster li").filter({hasText:name})).toContainText("100 points");

    await spanish.reload();
    await expect(spanish.locator("#status")).toHaveText("Reconectado.");
    await expect(spanish.locator("html")).toHaveAttribute("lang","es");
    await expect(host.locator("#roster li")).toHaveCount(3);
    await expect(host.locator("#roster li").filter({hasText:"Español"})).toContainText("100 points");

    await host.locator("#tv-language").selectOption("es");
    await expect(host.locator("#roster li").filter({hasText:"Español"})).toContainText("100 puntos");
    await expect(english.locator("html")).toHaveAttribute("lang","en");
  } finally {
    await Promise.all(contexts.map(context=>context.close()));
  }
});
