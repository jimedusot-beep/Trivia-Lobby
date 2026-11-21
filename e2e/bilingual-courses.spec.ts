import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";

async function create(page: Page, count = 6, title = "Home") {
  await page.goto("/party/create.html"); await page.locator("#display-language").selectOption("es");
  const content = "Question,OptionA,OptionB,Correct,Explanation\n" + Array.from({length:count}, (_,i)=>`${i === 0 ? "Correct!" : `Question ${i+1}`},Roots,Mars,A,Private study library`).join("\n");
  await page.locator("#import-file").setInputFiles({name:"course.csv",mimeType:"text/csv",buffer:Buffer.from(content)});
  await expect(page.locator("#question-list li")).toHaveCount(count); await page.locator("#quiz-title").fill(title);
  await page.locator("#learn-quiz").click(); await expect(page.locator("#course-title")).toHaveText(title);
}
async function locale(page: Page, value: string) {
  await page.locator("#display-language").focus(); await page.locator("#display-language").selectOption(value);
  await expect(page.locator("#display-language")).toBeFocused();
}
async function answer(page: Page) { await page.getByRole("button",{name:"A. Roots",exact:true}).click(); await page.locator("#continue").click(); }
async function download(page: Page) {
  if (!await page.locator("#export").isVisible()) await page.locator(".backup summary").click();
  const pending=page.waitForEvent("download");await page.locator("#export").click();return readFile((await (await pending).path())!,"utf8");
}

async function delayLearningWrites(page: Page) {
  await page.addInitScript(()=>{
    const descriptor=Object.getOwnPropertyDescriptor(IDBTransaction.prototype,"oncomplete")!;
    Object.defineProperty(IDBTransaction.prototype,"oncomplete",{...descriptor,set(handler){
      // Delay delivery, not writes: exercise a real IndexedDB completion after a locale change.
      const delayed=this.db.name==="trivia-lobby-local-learning" && this.mode==="readwrite" && typeof handler==="function";
      descriptor.set!.call(this,delayed?function(this:IDBTransaction,event:Event){setTimeout(()=>handler.call(this,event),500);}:handler);
    }});
  });
}

test("courses bilingual: retry, reload, scores and focus survive language changes", async ({page})=>{
  await create(page); await expect(page.locator("main")).toHaveAttribute("lang","es");
  await expect(page.locator("#path button").nth(1)).toBeDisabled();
  await page.locator("#daily").click(); await expect(page.locator("#lesson-heading")).toHaveText("Correct!");
  await page.getByRole("button",{name:"B. Mars",exact:true}).click();
  for(const value of ["en","es"]) {
    await locale(page,value); await expect(page.locator("#choices button:disabled")).toHaveCount(2);
    await expect(page.locator("#answer-result")).toHaveText(value==="es"?"Buen intento. Aquí está la respuesta.":"Good try. Here’s the answer.");
    await expect(page.locator("#answer-explanation")).toHaveText(value==="es"?"Respuesta correcta: Roots. Private study library":"Correct answer: Roots. Private study library");
  }
  await page.reload(); await page.locator("#resume").click();
  await expect(page.locator("#choices button:disabled")).toHaveCount(2); await expect(page.locator("#question-position")).toContainText("Pregunta 1 de 5");
  await page.locator("#continue").click(); for(let i=0;i<4;i++)await answer(page);
  await expect(page.locator("#question-position")).toContainText("Reintento 1 de 1"); await answer(page);
  await expect(page.locator("#summary")).toBeVisible();await expect(page.locator("#xp")).toHaveText("45 XP de práctica");
  await expect(page.locator("#score")).toHaveText("Primer intento: 4 de 5 respuestas correctas.");
  await expect(page.locator("#milestones")).toContainText("Primera lección");
  await locale(page,"en"); await expect(page.locator("#milestones")).toContainText("First lesson");
  await expect(page.locator("#earned-xp")).toContainText("+45 practice XP");
  await locale(page,"es");await expect(page.locator("#summary")).toBeVisible();
  await page.locator("#next-lesson").click();await answer(page);await expect(page.locator("#xp")).toHaveText("60 XP de práctica");
  await page.locator("#path button").first().click();for(let i=0;i<5;i++)await answer(page);
  await expect(page.locator("#xp")).toHaveText("60 XP de práctica");await page.reload();await expect(page.locator("#xp")).toHaveText("60 XP de práctica");
  await expect(page.locator("#course-progress")).toHaveText("2 / 2 lecciones completadas");
});

test("courses bilingual: backup restore preserves raw authored data and progress across independent contexts",async({page,browser})=>{
  const requests:string[]=[];page.on("request",r=>{if(new URL(r.url()).pathname.startsWith("/api/"))requests.push(r.url());});
  await create(page,1);await page.locator("#daily").click();await answer(page);const data=await download(page);
  const before=JSON.parse(data);expect(before.decks[0].title).toBe("Home");expect(before.decks[0].questions[0].prompt).toBe("Correct!");
  const context=await browser.newContext();try{
    const restored=await context.newPage();await restored.goto("/party/learn.html?lang=es");await restored.locator(".backup summary").click();
    await restored.locator("#restore").setInputFiles({name:"learning.json",mimeType:"application/json",buffer:Buffer.from(data)});
    await expect(restored.locator("#status")).toContainText("Se ha restaurado 1 cuestionario");await expect(restored.locator("#xp")).toHaveText("15 XP de práctica");
    await locale(restored,"en");await expect(restored.locator("#status")).toContainText("Restored 1 quizzes");
    const after=JSON.parse(await download(restored));expect(after.decks).toEqual(before.decks);expect(after.progress).toEqual(before.progress);
  }finally{await context.close();}expect(requests).toEqual([]);
});

test("courses bilingual: blocked learning storage remains visibly session-only in either language",async({page})=>{
  await create(page,1);await page.addInitScript(()=>{const open=IDBFactory.prototype.open;IDBFactory.prototype.open=function(name,version){if(name==="trivia-lobby-local-learning")throw new DOMException("Synthetic denial","SecurityError");return open.call(this,name,version);};});
  await page.reload();await expect(page.locator("#storage-note")).toContainText("solo durante esta sesión de página");
  await page.locator("#daily").click();await answer(page);await expect(page.locator("#earned-xp")).toContainText("Solo durante esta sesión de página");
  await locale(page,"en");await expect(page.locator("#storage-note")).toContainText("page session only");await expect(page.locator("#earned-xp")).toContainText("page session only");
  await locale(page,"es");await page.reload();await expect(page.locator("#xp")).toHaveText("0 XP de práctica");
});

test("courses bilingual: invalid backups retain data and localized errors survive language switches",async({page})=>{
  await create(page,1);await page.locator("#daily").click();await answer(page);await page.locator(".backup summary").click();
  await page.locator("#restore").setInputFiles({name:"bad.json",mimeType:"application/json",buffer:Buffer.from('{"users":["synthetic"]}')});
  await expect(page.locator("#status")).toContainText("Elige una copia de aprendizaje de Trivia Lobby");
  await locale(page,"en");await expect(page.locator("#status")).toContainText("Choose a Trivia Lobby learning backup");
  await locale(page,"es");await expect(page.locator("#xp")).toHaveText("15 XP de práctica");await expect(page.locator("#course-title")).toHaveText("Home");
});

test("courses bilingual: Spanish controls and long authored text fit phones and pass accessibility checks",async({page})=>{
  await create(page,1,"Home".repeat(20));for(const width of [320,390]){await page.setViewportSize({width,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
  await page.locator("#daily").focus();await page.keyboard.press("Enter");await expect(page.locator("#lesson-heading")).toBeFocused();
  await page.getByRole("button",{name:"A. Roots",exact:true}).focus();await page.keyboard.press("Enter");await expect(page.locator("#continue")).toBeFocused();
  await locale(page,"es");expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
});

test("courses bilingual: delayed checkpoint and completion preserve selector focus without errors or duplicate XP",async({page})=>{
  const errors:string[]=[];page.on("pageerror",error=>errors.push(error.message));
  await delayLearningWrites(page);
  await create(page,1);await page.locator("#daily").click();await expect(page.locator("#lesson-heading")).toBeVisible();
  await page.getByRole("button",{name:"A. Roots",exact:true}).click();await locale(page,"en");
  await expect(page.locator("#feedback")).toBeVisible();await expect(page.locator("#display-language")).toBeFocused();
  await page.locator("#continue").click();await locale(page,"es");await expect(page.locator("#summary")).toBeVisible();
  await expect(page.locator("#display-language")).toBeFocused();await expect(page.locator("#xp")).toHaveText("15 XP de práctica");
  expect(errors).toEqual([]);await page.reload();await expect(page.locator("#xp")).toHaveText("15 XP de práctica");
});


test("courses bilingual: language changes during final save retain the completed summary without exceptions",async({page})=>{
  const errors:string[]=[];page.on("pageerror",error=>errors.push(error.message));await delayLearningWrites(page);
  await create(page,1);await page.locator("#daily").click();await expect(page.locator("#lesson-heading")).toBeVisible();
  await page.getByRole("button",{name:"A. Roots",exact:true}).click();await expect(page.locator("#feedback")).toBeVisible();
  await page.locator("#continue").click();await page.locator("#display-language").focus();await page.locator("#display-language").selectOption("en");
  await expect(page.locator("#summary")).toBeVisible();expect(errors).toEqual([]);
  await expect(page.locator("#display-language")).toBeFocused();await expect(page.locator("#xp")).toHaveText("15 practice XP");
});
