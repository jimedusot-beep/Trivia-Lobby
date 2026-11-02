import { test, expect } from "@playwright/test";

async function mixedRoom(browser, mode) {
  const contexts = [];
  const openPage = async (mobile = false) => {
    const context = await browser.newContext({ viewport: mobile ? {width:390,height:844} : {width:1280,height:800} });
    contexts.push(context);
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.locator("#status")).toHaveText("Connected.");
    return page;
  };
  try {
    const host = await openPage();
    await host.locator("#create").click();
    // Creating the room is asynchronous: never read the join code before
    // the authoritative host lobby state has arrived over the WebSocket.
    await expect(host.locator("#heading")).toHaveText(/^[A-Z0-9]{6} · lobby$/);
    const code=(await host.locator("#heading").innerText()).split(" · ")[0];
    const guests=[];
    for(let i=0;i<3;i++) {
      const page = await openPage(true);
      if(i===0) await page.locator("#party-language").selectOption("es");
      await page.locator("#code").fill(code);
      await page.locator("#name").fill(["Español","English","Guest"][i]);
      await page.locator("#join button").click();
      await expect(page.locator("body")).toHaveClass(/phone-controller-active/);
      guests.push(page);
    }
    await host.locator("#mode").selectOption(mode);
    await host.getByRole("button",{name:"Start match",exact:true}).click();
    await expect(host.locator("#heading")).toContainText("question");
    return {host,guests,close:()=>Promise.all(contexts.map(context=>context.close()))};
  } catch (error) {
    await Promise.all(contexts.map(context=>context.close()));
    throw error;
  }
}

test("Survey Showdown gives Spanish pasaporte and English passport equal scores", async ({browser}) => {
  const room=await mixedRoom(browser,"survey");
  try {
    const [es,en,third]=room.guests;
    await expect(es.locator("#phone-prompt")).toContainText("vacaciones");
    await expect(en.locator("#phone-prompt")).toContainText("vacation");
    await es.locator("#social-response").fill("pasaporte");
    await es.getByRole("button",{name:"Confirmar respuesta",exact:true}).click();
    await en.locator("#social-response").fill("passport");
    await en.getByRole("button",{name:"Lock answer",exact:true}).click();
    await third.locator("#social-response").fill("not a valid survey answer");
    await third.getByRole("button",{name:"Lock answer",exact:true}).click();
    await expect(room.host.locator("#heading")).toContainText("reveal");
    await expect(room.host.locator("#roster")).toContainText("Español: 100 points");
    await expect(room.host.locator("#roster")).toContainText("English: 100 points");
    await expect(es.locator("#phone-prompt")).toContainText("vacaciones");
    await expect(room.host.locator("#content")).toContainText("Passport: 100 points · 2 matches");
  } finally { await room.close(); }
});

test("Category Clash scores piña and pineapple in one duplicate bucket", async ({browser}) => {
  const room=await mixedRoom(browser,"category");
  try {
    const [es,en,third]=room.guests;
    await expect(es.locator("#phone-prompt")).toContainText("fruta");
    await expect(en.locator("#phone-prompt")).toContainText("fruit");
    await es.locator("#family-response").fill("piña");
    await es.getByRole("button",{name:"Confirmar respuesta",exact:true}).click();
    await en.locator("#family-response").fill("pineapple");
    await en.getByRole("button",{name:"Lock answer",exact:true}).click();
    await third.locator("#family-response").fill("pear");
    await third.getByRole("button",{name:"Lock answer",exact:true}).click();
    await expect(room.host.locator("#heading")).toContainText("reveal");
    await expect(room.host.locator("#roster")).toContainText("Español: 50 points");
    await expect(room.host.locator("#roster")).toContainText("English: 50 points");
    await expect(room.host.locator("#roster")).toContainText("Guest: 100 points");
  } finally { await room.close(); }
});
