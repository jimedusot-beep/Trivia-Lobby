import { test, expect } from "@playwright/test";

test("question bank offers type filtering, text search, independent duplication and safe preview",async({browser,baseURL})=>{
  const context=await browser.newContext(),page=await context.newPage();
  const email="creator-"+Date.now()+"-"+Math.random().toString(36).slice(2)+"@example.test";
  let deckId:number|undefined;
  try{
    const joined=await context.request.post(baseURL+"/api/auth/register",{data:{email,password:"Creator-passphrase-2026"}});
    expect(joined.status()).toBe(201);
    const created=await context.request.post(baseURL+"/api/decks",{data:{title:"Creator bank test",category:"Study"}});
    expect(created.status()).toBe(201);
    deckId=(await created.json()).id;
    const questions=[
      {schemaVersion:1,prompt:"What is a quasar?",answer:{kind:"multiple_choice",options:[{id:"A",label:"Active galactic nucleus"},{id:"B",label:"Moon"}],correctOptionIds:["A"]}},
      {schemaVersion:1,prompt:"Review Greek mythology",answer:{kind:"flashcard",back:"Athena"}},
    ];
    for(const item of questions){
      const response=await context.request.post(baseURL+"/api/decks/"+deckId+"/questions",{data:item});
      expect(response.status(),await response.text()).toBe(201);
    }
    await page.goto(baseURL+"/exam-builder/"+deckId);
    await expect(page.getByText("Question bank (2)")).toBeVisible();
    await page.getByLabel("Search saved questions").fill("quasar");
    await expect(page.getByText("1. What is a quasar?")).toBeVisible();
    await expect(page.getByText("2. Review Greek mythology")).toHaveCount(0);
    await page.getByLabel("Search saved questions").fill("");
    await page.getByLabel("Filter question types").selectOption("study");
    await expect(page.getByText("2. Review Greek mythology")).toBeVisible();
    await expect(page.getByText("1. What is a quasar?")).toHaveCount(0);
    await page.getByLabel("Filter question types").selectOption("live");
    await expect(page.getByText("1. What is a quasar?")).toBeVisible();
    await page.getByRole("button",{name:"Preview"}).click();
    await expect(page.getByRole("region",{name:"Question player preview"})).toBeVisible();
    await expect(page.getByText("Active galactic nucleus")).toBeVisible();
    await expect(page.getByText("Moon",{exact:true})).toBeVisible();
    await page.getByRole("button",{name:"Close preview"}).click();
    await page.getByRole("button",{name:"Duplicate"}).click();
    await expect(page.getByText("Question bank (3)")).toBeVisible();
    await expect(page.getByText(/What is a quasar\? \(copy/)).toBeVisible();
    await page.reload();
    await expect(page.getByText("Question bank (3)")).toBeVisible();
  }finally{
    if(deckId)await context.request.delete(baseURL+"/api/decks/"+deckId).catch(()=>{});
    await context.close();
  }
});
