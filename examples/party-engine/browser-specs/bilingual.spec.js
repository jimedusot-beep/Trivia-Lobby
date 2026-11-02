import { test, expect } from "@playwright/test";

test("English host and Spanish guest share quiz answers without changing scores", async ({ browser }) => {
  const contexts = [];
  const newPage = async viewport => {
    const context = await browser.newContext({ viewport });
    contexts.push(context);
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.locator("#status")).toHaveText("Connected.");
    return page;
  };
  try {
    const host = await newPage({width:1280,height:800});
    await host.locator("#create").click();
    const code = (await host.locator("#heading").innerText()).split(" · ")[0];
    const guests = [];
    for (let i=0;i<3;i++) {
      const page = await newPage({width:390,height:844});
      await page.locator("#code").fill(code);
      await page.locator("#name").fill("Bilingual guest " + i);
      await page.locator("#join button").click();
      await expect(page.locator("body")).toHaveClass(/phone-controller-active/);
      guests.push(page);
    }
    const [spanish, english] = guests;
    await spanish.locator("#phone-menu-options").click();
    await spanish.locator("#phone-language").selectOption("es");
    await expect(spanish.locator("html")).toHaveAttribute("lang","es");
    await expect(english.locator("html")).toHaveAttribute("lang","en");

    await host.locator("#mode").selectOption("quiz");
    await host.getByRole("button",{name:"Start match",exact:true}).click();
    await expect(host.locator("#heading")).toContainText("question");
    await expect(spanish.locator("#phone-prompt")).toContainText("¿Qué figura tiene exactamente tres lados?");
    await expect(english.locator("#phone-prompt")).toContainText("Which shape has exactly three sides?");
    await spanish.getByRole("button",{name:"Triángulo",exact:true}).click();
    await english.getByRole("button",{name:"Triangle",exact:true}).click();
    await guests[2].getByRole("button",{name:"Triangle",exact:true}).click();
    await expect(host.locator("#heading")).toContainText("reveal");
    await expect(host.locator("#roster")).toContainText("100 points");
    await expect(spanish.locator("#phone-menu-options")).toHaveText("Opciones");
    await expect(english.locator("#phone-menu-options")).toHaveText("Options");
  } finally {
    await Promise.all(contexts.map(context => context.close()));
  }
});

test("language selection survives reload and leaves English fallback intact", async ({ page }) => {
  await page.goto("/");
  await page.locator("#party-language").selectOption("es");
  await expect(page.getByRole("heading",{name:"Elige un juego"})).toBeVisible();
  await expect(page.locator("[data-game='quiz']")).toContainText("Trivia");
  await expect(page.locator(".pick-spotlight-language")).toContainText("inglés");
  await page.reload();
  await expect(page.locator("#party-language")).toHaveValue("es");
  await page.locator("#party-language").selectOption("en");
  await expect(page.getByRole("heading",{name:"Pick a Game"})).toBeVisible();
});
