import {test,expect} from "@playwright/test";

async function mixedLanguageRoom(browser, mode, observeHostFrame) {
  const contexts=[];
  async function open(mobile=false) {
    const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:800}});
    contexts.push(context);
    const page=await context.newPage();
    if (!mobile && observeHostFrame) page.on("websocket", socket =>
      socket.on("framesent", frame => observeHostFrame(JSON.parse(frame.payload))));
    await page.goto("/");
    await expect(page.locator("#status")).toHaveText("Connected.");
    return page;
  }
  try {
    const host=await open();
    await host.locator("#create").click();
    // Creating the room is asynchronous: never read the join code before
    // the authoritative host lobby state has arrived over the WebSocket.
    await expect(host.locator("#heading")).toHaveText(/^[A-Z0-9]{6} · lobby$/);
    const code=(await host.locator("#heading").innerText()).split(" · ")[0];
    const players=[];
    for(const [index,name] of ["Español","English","Guest"].entries()) {
      const page=await open(true);
      if(index===0) await page.locator("#party-language").selectOption("es");
      await page.locator("#code").fill(code);
      await page.locator("#name").fill(name);
      await page.locator("#join button").click();
      await expect(page.locator("body")).toHaveClass(/phone-controller-active/);
      players.push(page);
    }
    await host.locator("#mode").selectOption(mode);
    await host.getByRole("button",{name:"Start match",exact:true}).click();
    await expect(host.locator("#heading")).toContainText("question");
    return {host,players,close:()=>Promise.all(contexts.map(c=>c.close()))};
  } catch(e) {
    await Promise.all(contexts.map(c=>c.close()));
    throw e;
  }
}

const surveys=[
  ["pasaporte","passport","pasaporte falso","vacaciones","vacation","Passport"],
  ["palomitas de maíz","popcorn","pochoclo falso","cine","movie theater","Popcorn"],
  ["jarabe de maple","syrup","jarabe falso","panqueques","pancakes","Syrup"],
  ["toalla","towel","toalla falsa","playa","beach","Towel"],
  ["leche","milk","leche falsa","refrigerador","refrigerator","Milk"],
];

test("Survey Showdown: all five bilingual rounds retain rank, privacy and reveal counts",async({browser})=>{
  const room=await mixedLanguageRoom(browser,"survey");
  try {
    const [es,en,other]=room.players;
    for(const [round,[spanish,english,wrong,esPrompt,enPrompt,canonical]] of surveys.entries()) {
      await expect(room.host.locator("#heading")).toContainText("question");
      await expect(es.locator("#phone-prompt")).toContainText(esPrompt);
      await expect(en.locator("#phone-prompt")).toContainText(enPrompt);
      await es.locator("#social-response").fill(spanish);
      await es.getByRole("button",{name:"Confirmar respuesta",exact:true}).click();
      await expect(room.host.locator("#content")).not.toContainText(spanish);
      await expect(room.host.locator("#roster")).toContainText(`Español: ${round*100} points`);
      await en.locator("#social-response").fill(english);
      await en.getByRole("button",{name:"Lock answer",exact:true}).click();
      await other.locator("#social-response").fill(wrong);
      await other.getByRole("button",{name:"Lock answer",exact:true}).click();
      await expect(room.host.locator("#heading")).toContainText("reveal");
      await expect(room.host.locator("#roster")).toContainText(`Español: ${(round+1)*100} points`);
      await expect(room.host.locator("#roster")).toContainText(`English: ${(round+1)*100} points`);
      await expect(room.host.locator("#roster")).toContainText("Guest: 0 points");
      await expect(room.host.locator("#content")).toContainText(`${canonical}: 100 points · 2 matches`);
      await room.host.getByRole("button",{name:"Next",exact:true}).click();
    }
    await expect(room.host.locator("#heading")).toContainText("finished");
  } finally {await room.close();}
});

const categories=[
  ["piña","pineapple","plátano","fruta","fruit"],
  ["camello","camel","capibara","animal","animal"],
  ["berlín","berlin","bogotá","ciudad","city"],
  ["sopa","soup","salchicha","comida","food"],
  ["méxico","mexico","malasia","país","country"],
];

test("Category Clash: all five bilingual rounds share duplicates and keep distinct names",async({browser})=>{
  const room=await mixedLanguageRoom(browser,"category");
  try {
    const [es,en,other]=room.players;
    for(const [round,[spanish,english,unique,esPrompt,enPrompt]] of categories.entries()) {
      await expect(room.host.locator("#heading")).toContainText("question");
      await expect(es.locator("#phone-prompt")).toContainText(esPrompt);
      await expect(en.locator("#phone-prompt")).toContainText(enPrompt);
      await es.locator("#family-response").fill(spanish);
      await es.getByRole("button",{name:"Confirmar respuesta",exact:true}).click();
      await expect(room.host.locator("#content")).not.toContainText(spanish);
      await en.locator("#family-response").fill(english);
      await en.getByRole("button",{name:"Lock answer",exact:true}).click();
      await other.locator("#family-response").fill(unique);
      await other.getByRole("button",{name:"Lock answer",exact:true}).click();
      await expect(room.host.locator("#heading")).toContainText("reveal");
      await expect(room.host.locator("#roster")).toContainText(`Español: ${(round+1)*50} points`);
      await expect(room.host.locator("#roster")).toContainText(`English: ${(round+1)*50} points`);
      await expect(room.host.locator("#roster")).toContainText(`Guest: ${(round+1)*100} points`);
      await expect(room.host.locator("#content")).toContainText(spanish);
      await expect(room.host.locator("#content")).toContainText(unique);
      await room.host.getByRole("button",{name:"Next",exact:true}).click();
    }
    await expect(room.host.locator("#heading")).toContainText("finished");
  } finally {await room.close();}
});

test("Survey Showdown: Next survives a guest disconnect during a pointer click", async ({browser}) => {
  const room=await mixedLanguageRoom(browser,"survey");
  try {
    const [es,en,other]=room.players;
    for (const [page,value,label] of [[es,"pasaporte","Confirmar respuesta"],[en,"passport","Lock answer"],[other,"pasaporte falso","Lock answer"]]) {
      await page.locator("#social-response").fill(value);
      await page.getByRole("button",{name:label,exact:true}).click();
    }
    await expect(room.host.locator("#heading")).toContainText("reveal");
    await expect(room.host.locator("#roster")).toContainText("English: 100 points");
    const next=room.host.getByRole("button",{name:"Next",exact:true});
    await expect(next).toBeEnabled();
    await next.scrollIntoViewIfNeeded();
    await expect(next).toBeInViewport();
    await next.hover();
    await room.host.mouse.down();
    await other.close();
    await expect(room.host.locator("#roster")).toContainText("disconnected",{timeout:10000});
    await expect(room.host.locator("#heading")).toContainText("reveal");
    await room.host.mouse.up();
    await expect(room.host.locator("#heading")).toContainText("question",{timeout:5000});
  } finally {
    await room.host.mouse.up().catch(()=>{});
    await room.close();
  }
});

async function surveyReveal(browser, observeHostFrame) {
  const room=await mixedLanguageRoom(browser,"survey",observeHostFrame);
  try {
    for (const [page,value,label] of [[room.players[0],"pasaporte","Confirmar respuesta"],[room.players[1],"passport","Lock answer"],[room.players[2],"pasaporte falso","Lock answer"]]) {
      await page.locator("#social-response").fill(value);
      await page.getByRole("button",{name:label,exact:true}).click();
    }
    await expect(room.host.locator("#heading")).toContainText("reveal");
    return room;
  } catch(error) { await room.close(); throw error; }
}

test("Survey Showdown: focused Space activation survives a guest disconnect",async({browser})=>{
  const room=await surveyReveal(browser);
  try {
    const next=room.host.getByRole("button",{name:"Next",exact:true});
    await next.focus();
    await room.host.keyboard.down("Space");
    await room.players[2].close();
    await expect(room.host.locator("#roster")).toContainText("disconnected");
    await expect(next).toBeFocused();
    await room.host.keyboard.up("Space");
    await expect(room.host.locator("#heading")).toContainText("question");
  } finally { await room.host.keyboard.up("Space").catch(()=>{}); await room.close(); }
});

test("Survey Showdown: rapid Next activation sends one request",async({browser})=>{
  const frames=[];
  const room=await surveyReveal(browser,frame=>frames.push(frame));
  try {
    // Two native DOM activations in the same task exercise the synchronous
    // pending-action guard without delaying or mocking the real server ACK.
    await room.host.getByRole("button",{name:"Next",exact:true}).evaluate(button=>{button.click();button.click();});
    await expect(room.host.locator("#heading")).toContainText("question");
    await expect(room.players[1].locator("#phone-prompt")).toContainText("movie theater");
    expect(frames.filter(frame=>frame.type==="next")).toHaveLength(1);
  } finally { await room.close(); }
});

test("Survey Showdown: phase change cancels a held Next pointer",async({browser})=>{
  const frames=[];
  const room=await surveyReveal(browser,frame=>frames.push(frame));
  try {
    const next=room.host.getByRole("button",{name:"Next",exact:true});
    await next.hover();
    await room.host.mouse.down();
    // Native Enter advances while the pointer is held. Its later release
    // must not activate the obsolete reveal control in the new question.
    await room.host.keyboard.press("Enter");
    await expect(room.host.locator("#heading")).toContainText("question");
    await room.host.mouse.up();
    await expect(room.players[1].locator("#phone-prompt")).toContainText("movie theater");
    expect(frames.filter(frame=>frame.type==="next")).toHaveLength(1);
  } finally { await room.host.mouse.up().catch(()=>{}); await room.close(); }
});
