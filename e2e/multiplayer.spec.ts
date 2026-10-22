import { test,expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("private host and two guests answer, reload, retain scores and finish on mobile",async({browser,baseURL})=>{
  const hostContext=await browser.newContext(),oneContext=await browser.newContext({viewport:{width:375,height:812}}),twoContext=await browser.newContext();
  const host=await hostContext.newPage(),one=await oneContext.newPage(),two=await twoContext.newPage();
  let deckId=0;
  try {
    const signup=await hostContext.request.post(baseURL+"/api/auth/register",{data:{email:`host-${Date.now()}@example.test`,password:"Browser-test-passphrase-2026"}});
    expect(signup.status()).toBe(201);
    const imported=await hostContext.request.post(baseURL+"/api/decks/import",{data:{deck:{title:"Browser multiplayer"},cards:[1,2].map(n=>({type:"multiple_choice",front:`Pick Paris ${n}`,back:"Paris",options:["Rome","Paris","Oslo","Lima"],correctOption:"B"}))}});
    expect(imported.status()).toBe(201);deckId=(await imported.json()).id;
    await host.goto(`/host/${deckId}`);
    await expect(host.getByTestId("room-code")).toHaveText(/^[A-HJ-NP-Z2-9]{6}$/);
    const code=(await host.getByTestId("room-code").innerText()).trim();
    for(const [page,name] of [[one,"Ada"],[two,"Lin"]] as const){
      await page.goto("/join");await page.getByLabel("Room Code").fill(code);await page.getByLabel("Your Name").fill(name);
      await page.getByRole("button",{name:"Enter Game"}).click();await expect(page.getByRole("heading",{name:"Joined lobby"})).toBeVisible();
    }
    await expect(host.getByText("2 Players",{exact:true})).toBeVisible();
    await host.getByRole("button",{name:"Start Game"}).click();
    await one.getByRole("button",{name:"B: Paris",exact:true}).click();
    await expect(one.getByRole("status").filter({hasText:"Answer received"})).toBeVisible();
    // Reload while waiting for the second guest: no duplicate answer controls or early score leak.
    await one.reload();await expect(one.getByRole("status").filter({hasText:"Answer received"})).toBeVisible();
    await expect(one.getByText("0 pts",{exact:true})).toBeVisible();
    await two.getByRole("button",{name:"A: Rome",exact:true}).click();
    await expect(one.getByRole("heading",{name:"Correct!",exact:true})).toBeVisible();
    await host.getByRole("button",{name:"Show leaderboard"}).click();
    await expect(one.getByText("100 pts",{exact:true}).first()).toBeVisible();
    await host.reload();await expect(host.getByRole("button",{name:"Next / Finish"})).toBeVisible();
    await host.getByRole("button",{name:"Next / Finish"}).click();
    await one.getByRole("button",{name:"B: Paris",exact:true}).click();await two.getByRole("button",{name:"B: Paris",exact:true}).click();
    await host.getByRole("button",{name:"Show leaderboard"}).click();await host.getByRole("button",{name:"Next / Finish"}).click();
    await expect(one.getByRole("heading",{name:"Game Over!"})).toBeVisible();
    await expect(one.getByText("210 pts",{exact:true}).first()).toBeVisible();
    expect(await one.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
    const accessibility=await new AxeBuilder({page:one}).withTags(["wcag2a","wcag2aa"]).analyze();
    expect(accessibility.violations.filter(v=>["critical","serious"].includes(v.impact??""))).toEqual([]);
  }finally{
    if(deckId)await hostContext.request.delete(baseURL+`/api/decks/${deckId}`);
    await hostContext.close();await oneContext.close();await twoContext.close();
  }
});

test("builder draft survives reload and recovers on another signed-in browser",async({browser,baseURL})=>{
  const first=await browser.newContext(),second=await browser.newContext();const page=await first.newPage();
  const email=`draft-${Date.now()}@example.test`,password="Browser-test-passphrase-2026";
  let deckId=0;
  try{
    expect((await first.request.post(baseURL+"/api/auth/register",{data:{email,password}})).status()).toBe(201);
    const created=await first.request.post(baseURL+"/api/decks",{data:{title:"Draft recovery"}});deckId=(await created.json()).id;
    await page.goto(`/exam-builder/${deckId}`);await expect(page.getByText("Draft recovery ready",{exact:true})).toBeVisible();
    await page.getByLabel("Question prompt").fill("Unsaved cross-device draft");
    await page.getByLabel("Choice 1 text").fill("Left");await page.getByLabel("Choice 2 text").fill("Right");
    await expect(page.getByText("Draft saved",{exact:true})).toBeVisible();
    await page.reload();await expect(page.getByLabel("Question prompt")).toHaveValue("Unsaved cross-device draft");
    expect((await second.request.post(baseURL+"/api/auth/login",{data:{email,password}})).status()).toBe(200);
    const other=await second.newPage();await other.goto(`/exam-builder/${deckId}`);await expect(other.getByLabel("Choice 2 text")).toHaveValue("Right");
  }finally{if(deckId)await first.request.delete(baseURL+`/api/decks/${deckId}`);await first.close();await second.close();}
});
