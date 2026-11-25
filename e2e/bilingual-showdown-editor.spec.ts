import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";

const key = "trivia-lobby-show-v1";
async function open(page: Page) { await page.goto("/party/show.html"); await page.locator("#display-language").selectOption("es"); }
async function locale(page: Page, value: string) {
  await page.locator("#display-language").focus(); await page.locator("#display-language").selectOption(value);
  await expect(page.locator("#display-language")).toBeFocused();
}
async function backup(page: Page) {
  const pending=page.waitForEvent("download");await page.locator("#export-show").click();
  const result=JSON.parse(await readFile((await (await pending).path())!,"utf8"));
  await expect(page.locator("#show-status")).toHaveText(await page.locator("#display-language").inputValue() === "es" ? "Copia JSON descargada." : "JSON backup downloaded.");
  return result;
}
const friendly = {
  title_text:"Home", rounds:[{question:"Correct!",answers:[{ans:"Roots",pnt:60},{ans:"Mars",pnt:40}],multiply:3}],
  final_round:Array.from({length:5},(_,i)=>({question:`Private study library ${i+1}`,answers:[["Roots",70],["Mars",30]]})),
};
const expectedShow = {
  title:"Home",rounds:[{question:"Correct!",answers:[{text:"Roots",points:60},{text:"Mars",points:40}],multiplier:3}],
  final:Array.from({length:5},(_,i)=>({question:`Private study library ${i+1}`,answers:[{text:"Roots",points:70},{text:"Mars",points:30}],multiplier:1})),
};
async function importFriendly(page: Page) {
  await page.locator("#import-show").setInputFiles({name:"friendly.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(friendly))});
  await expect(page.locator("#show-rounds article")).toHaveCount(1);
}

test("showdown editor bilingual: unsaved text and multipliers survive language changes and board actions",async({page})=>{
  await open(page);await expect(page.locator("main")).toHaveAttribute("lang","es");
  await expect(page.locator("#show-status")).toContainText("Todo listo");
  await expect(page.getByLabel("Título del duelo",{exact:true})).toHaveValue("Family Showdown");
  await expect(page.locator("#save-show")).toHaveText("Guardar en este dispositivo");
  await expect(page.locator("#host-show")).toHaveText("Guardar y crear duelo familiar");
  await page.locator("#show-title").fill("Home");await page.locator("#show-rounds-question-0").fill("Correct!");
  await page.locator("#show-rounds-answers-0").fill("Roots | 60\nMars | 40");await page.locator("#show-multiplier-0").selectOption("3");
  await page.locator("#show-rounds-answers-0").fill("An unfinished line");
  for(const value of ["en","es"]) {
    await locale(page,value);await expect(page.locator("#show-title")).toHaveValue("Home");
    await expect(page.locator("#show-rounds-question-0")).toHaveValue("Correct!");await expect(page.locator("#show-rounds-answers-0")).toHaveValue("An unfinished line");
    await expect(page.locator("#show-multiplier-0")).toHaveValue("3");await expect(page.locator("#show-rounds h3").first()).toHaveText(value==="es"?"Tablero 1":"Board 1");
  }
  await page.locator("#show-rounds-answers-0").fill("Roots | 60\nMars | 40");await page.locator("#add-board").click();await expect(page.locator("#show-rounds article")).toHaveCount(4);
  await page.locator("#show-rounds article").last().getByRole("button",{name:"Eliminar este tablero",exact:true}).click();await expect(page.locator("#show-rounds article")).toHaveCount(3);
  await page.locator("#save-show").click();await expect(page.locator("#show-status")).toContainText("guardado en este dispositivo");
  const before=await backup(page);await page.reload();expect(await backup(page)).toEqual(before);
  expect(before.show.rounds[0]).toEqual({question:"Correct!",answers:[{text:"Roots",points:60},{text:"Mars",points:40}],multiplier:3});
});

test("showdown editor bilingual: Friendly Feud roundtrip and host handoff preserve canonical show data",async({page})=>{
  const privateRequests:string[]=[];page.on("request",r=>{if(new URL(r.url()).pathname.startsWith("/api/"))privateRequests.push(r.url());});
  await open(page);await importFriendly(page);await expect(page.locator("#show-status")).toHaveText("Partida importada. Guárdala en este dispositivo y crea la sala cuando quieras.");
  await expect(page.locator("#show-title")).toHaveValue("Home");await expect(page.locator("#show-title")).toHaveAttribute("lang","");
  const before=await backup(page);expect(before).toEqual({format:"trivia-lobby-show",version:1,show:expectedShow});
  await locale(page,"en");expect(await backup(page)).toEqual(before);await locale(page,"es");
  await page.locator("#host-show").click();await expect(page).toHaveURL(/\/party\/\?game=feud/);
  await expect(page.locator("#heading")).toContainText("sala");await expect(page.locator("#mode")).toHaveValue("feud");
  expect(await page.evaluate(()=>JSON.parse(sessionStorage.getItem("party-custom-show")!))).toEqual(expectedShow);expect(privateRequests).toEqual([]);
});

test("showdown editor bilingual: malformed answers and imports keep the draft and expose localized errors",async({page})=>{
  await open(page);await page.locator("#show-title").fill("Home");await page.locator("#show-rounds-answers-0").fill("No separator");await page.locator("#save-show").click();
  await expect(page.locator("#show-status")).toContainText("Cada respuesta necesita sus puntos después de |");
  await locale(page,"en");await expect(page.locator("#show-status")).toContainText("Each answer needs its points");
  await locale(page,"es");await page.locator("#show-rounds-answers-0").fill("Roots | 60\nMars | 41");await page.locator("#save-show").click();
  await expect(page.locator("#show-status")).toHaveText("Los puntos de las respuestas de cada tablero deben sumar 100.");
  await page.locator("#import-show").setInputFiles({name:"large.json",mimeType:"application/json",buffer:Buffer.alloc(32769,32)});
  await expect(page.locator("#show-status")).toHaveText("Usa un archivo de partida de 32 KB o menos.");
  for(const content of ['{"users":["synthetic"]}','not JSON']){
    await page.locator("#import-show").setInputFiles({name:"invalid.json",mimeType:"application/json",buffer:Buffer.from(content)});
    await expect(page.locator("#show-status")).not.toContainText("importada");await expect(page.locator("#show-title")).toHaveValue("Home");
    await expect(page.locator("#show-rounds-answers-0")).toHaveValue("Roots | 60\nMars | 41");
  }
  await expect(page.locator("#show-status")).toHaveText("El archivo no contiene JSON válido.");
  await page.locator("#show-rounds-answers-0").fill("Roots | 60\nMars | 40");await page.locator("#show-title").fill("");await page.locator("#save-show").click();
  await expect(page.locator("#show-status")).toHaveText("Usa entre 1 y 80 caracteres legibles.");
});

test("showdown editor bilingual: unreadable saved data keeps its warning and original stored bytes",async({page})=>{
  await page.addInitScript(()=>localStorage.setItem("trivia-lobby-show-v1",'{"version":999}'));
  await page.goto("/party/show.html");await expect(page.locator("#show-status")).toHaveText("Could not read a saved show. The sample is ready to edit.");
  await locale(page,"es");await expect(page.locator("#show-status")).toHaveText("No se ha podido leer la partida guardada. El ejemplo está listo para editar.");
  expect(await page.evaluate(k=>localStorage.getItem(k),key)).toBe('{"version":999}');
  await locale(page,"en");await expect(page.locator("#show-status")).toContainText("Could not read");
});

test("showdown editor bilingual: failed storage leaves edits exportable and prevents a false host handoff",async({page})=>{
  await page.addInitScript(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==="trivia-lobby-show-v1")throw new DOMException("Synthetic full storage","QuotaExceededError");return original.call(this,k,v);};});
  await open(page);await page.locator("#show-title").fill("Home");await page.locator("#save-show").click();
  await expect(page.locator("#show-status")).toHaveText("El almacenamiento del dispositivo está lleno. Exporta una copia y libera espacio.");
  await locale(page,"en");await expect(page.locator("#show-status")).toHaveText("Device storage is full. Export a backup and free some space.");
  expect((await backup(page)).show.title).toBe("Home");await page.locator("#host-show").click();await expect(page).toHaveURL(/\/party\/show.html$/);
  expect(await page.evaluate(k=>localStorage.getItem(k),key)).toBeNull();expect(await page.evaluate(()=>sessionStorage.getItem("party-custom-show"))).toBeNull();
});

test("showdown editor bilingual: phone layout, sample confirmation and accessible labels preserve authored text",async({page})=>{
  await open(page);await page.locator("#show-title").fill("Home".repeat(20));
  let confirmation="";page.once("dialog",async d=>{confirmation=d.message();await d.dismiss();});await page.locator("#sample-show").click();
  expect(confirmation).toContain("¿Sustituir el contenido actual");await expect(page.locator("#show-title")).toHaveValue("Home".repeat(20));
  for(const width of [320,390]){await page.setViewportSize({width,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
  await page.locator("details summary").click();await expect(page.locator("#show-final h3").first()).toHaveText("Pregunta relámpago 1");
  await expect(page.locator("#show-rounds-question-0")).toHaveAttribute("lang","");
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
  const original=await page.evaluate(async()=> (await import("/party/show-format.js")).defaultShow);
  page.once("dialog",async d=>d.accept());await page.locator("#sample-show").click();
  expect((await backup(page)).show).toEqual(original);expect(await page.evaluate(k=>localStorage.getItem(k),key)).toBeNull();
});
