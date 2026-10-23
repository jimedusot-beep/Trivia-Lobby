import { test, expect } from "@playwright/test";

test("creator-backed four-kind live quiz works through host and mobile player", async ({ browser, baseURL }) => {
  const hostContext=await browser.newContext();
  const guestContext=await browser.newContext({viewport:{width:390,height:844}});
  const host=await hostContext.newPage(),guest=await guestContext.newPage();
  let deckId:number|undefined;
  try {
    const signup=await hostContext.request.post(baseURL+"/api/auth/register",{
      data:{email:`mixed-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`,password:"Mixed-acceptance-passphrase-2026"}
    });
    expect(signup.status()).toBe(201);
    const created=await hostContext.request.post(baseURL+"/api/decks",{
      data:{title:"Mixed live acceptance",category:"General",description:"Original test questions"}
    });
    expect(created.status()).toBe(201);
    deckId=(await created.json()).id;
    const questions=[
      {prompt:"Choose the original",answer:{kind:"multiple_choice",options:[{id:"a",label:"Alpha"},{id:"b",label:"Beta"}],correctOptionIds:["a"]}},
      {prompt:"Is the sky blue?",gameplay:{timeLimitSeconds:45,points:"double"},answer:{kind:"true_false",correct:true}},
      {prompt:"Choose two animals",answer:{kind:"multiple_select",options:[{id:"dog",label:"Dog"},{id:"cat",label:"Cat"},{id:"rock",label:"Rock"}],correctOptionIds:["dog","cat"]}},
      {prompt:"Arrange by size",answer:{kind:"ordering",items:[{id:"large",label:"Large"},{id:"small",label:"Small"},{id:"medium",label:"Medium"}],correctOrderIds:["small","medium","large"]}},
    ];
    for(const q of questions){
      const res=await hostContext.request.post(baseURL+`/api/decks/${deckId}/questions`,{data:{schemaVersion:1,tags:[],...q}});
      expect(res.status(),await res.text()).toBe(201);
    }
    await host.goto(baseURL+`/host/${deckId}`);
    const room=host.getByTestId("room-code");
    await expect(room).toHaveText(/^[A-HJ-NP-Z2-9]{6}$/);
    const code=(await room.innerText()).trim();
    await expect(host.getByLabel("Direct invitation link")).toHaveValue(new RegExp(`/join\\?code=${code}`));
    await guest.goto(baseURL+`/join?code=${code}`);
    await expect(guest.getByLabel("Room Code")).toHaveValue(code);
    await guest.getByLabel("Your Name").fill("A guest");
    await guest.getByRole("button",{name:"Enter Game"}).click();
    await expect(guest.getByRole("heading",{name:"Joined lobby"})).toBeVisible();
    await host.getByRole("button",{name:"Start Game"}).click();

    await expect(guest.getByText("Choose the original")).toBeVisible();
    await guest.getByRole("button",{name:"A: Alpha"}).click();
    await expect(guest.getByRole("heading",{name:"Correct!"})).toBeVisible();
    await host.getByRole("button",{name:"Show leaderboard"}).click();
    await host.getByRole("button",{name:"Next / Finish"}).click();

    await expect(guest.getByText("Is the sky blue?")).toBeVisible();
    await guest.getByRole("button",{name:"True",exact:true}).click();
    await expect(guest.getByRole("heading",{name:"Correct!"})).toBeVisible();
    await host.getByRole("button",{name:"Show leaderboard"}).click();
    await host.getByRole("button",{name:"Next / Finish"}).click();

    await expect(guest.getByText("Choose two animals")).toBeVisible();
    await guest.getByRole("checkbox").nth(0).check();
    await guest.getByRole("checkbox").nth(1).check();
    await guest.getByRole("button",{name:"Submit selections"}).click();
    await expect(guest.getByRole("heading",{name:"Correct!"})).toBeVisible();
    await host.getByRole("button",{name:"Show leaderboard"}).click();
    await host.getByRole("button",{name:"Next / Finish"}).click();

    await expect(guest.getByText("Arrange by size")).toBeVisible();
    const order=["Small","Medium","Large"];
    const rows=guest.getByRole("listitem");
    for(let desired=0;desired<order.length;desired++){
      let list=await rows.allInnerTexts();
      let current=list.findIndex(text=>text.includes(order[desired]));
      expect(current).toBeGreaterThanOrEqual(desired);
      while(current>desired){
        await guest.getByRole("button",{name:`Move item ${current+1} up`}).click();
        current--;
      }
    }
    await guest.getByRole("button",{name:"Submit order"}).click();
    await expect(guest.getByRole("heading",{name:"Correct!"})).toBeVisible();
    await host.getByRole("button",{name:"Show leaderboard"}).click();
    await host.getByRole("button",{name:"Next / Finish"}).click();
    await expect(guest.getByRole("heading",{name:"Game Over!"})).toBeVisible();
  } finally {
    if(deckId) await hostContext.request.delete(baseURL+`/api/decks/${deckId}`).catch(()=>{});
    await hostContext.close();
    await guestContext.close();
  }
});
