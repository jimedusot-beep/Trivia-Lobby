import { test, expect } from "@playwright/test";

test("host and anonymous mobile player finish a match and restore both connections",async({browser,baseURL})=>{
 const hostContext=await browser.newContext(),playerContext=await browser.newContext({viewport:{width:375,height:812}});
 const host=await hostContext.newPage(),player=await playerContext.newPage();
 const email=`host-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`;
 const signup=await hostContext.request.post(baseURL+"/api/auth/register",{data:{email,password:"Browser-test-passphrase-2026"}});expect(signup.status()).toBe(201);
 const imported=await hostContext.request.post(baseURL+"/api/decks/import",{data:{deck:{title:"Browser multiplayer"},cards:[
  {front:"Choose the capital of France",back:"Paris is the capital.",type:"multiple_choice",options:["Paris","Rome","Lima","Oslo"],correctOption:"A"},
  {front:"Choose two",back:"The number is two.",type:"multiple_choice",options:["One","Two","Three","Four"],correctOption:"B"},
 ]}});expect(imported.status()).toBe(201);const deck=await imported.json();
 try{
  await host.goto(baseURL+`/host/${deck.id}`);
  const codeDisplay=host.getByTestId("room-code");await expect(codeDisplay).toHaveText(/^[A-HJ-NP-Z2-9]{6}$/);
  const roomCode=(await codeDisplay.innerText()).trim();
  await player.goto(baseURL+"/join");await player.getByLabel("Room Code").fill(roomCode);await player.getByLabel("Your Name").fill("Player Ada");await player.getByRole("button",{name:"Enter Game"}).click();
  await expect(player.getByRole("heading",{name:"Joined lobby"})).toBeVisible();await expect(host.getByText("Player Ada",{exact:true})).toBeVisible();
  await host.getByRole("button",{name:"Start Game"}).click();await expect(player.getByRole("button",{name:"A: Paris",exact:true})).toBeEnabled();
  await player.getByRole("button",{name:"A: Paris",exact:true}).click();await expect(player.getByRole("heading",{name:"Correct!",exact:true})).toBeVisible();
  await player.reload();await expect(player.getByRole("heading",{name:"Correct!",exact:true})).toBeVisible();
  await host.getByRole("button",{name:"Show leaderboard"}).click();await expect(player.getByText("100 pts",{exact:true}).first()).toBeVisible();
  await host.reload();await expect(host.getByRole("button",{name:"Next / Finish"})).toBeVisible();await host.getByRole("button",{name:"Next / Finish"}).click();
  await player.getByRole("button",{name:"B: Two",exact:true}).click();await expect(player.getByRole("heading",{name:"Correct!",exact:true})).toBeVisible();
  await host.getByRole("button",{name:"Show leaderboard"}).click();await host.getByRole("button",{name:"Next / Finish"}).click();
  await expect(host.getByRole("heading",{name:"GAME OVER",exact:true})).toBeVisible();await expect(player.getByRole("heading",{name:"Game Over!",exact:true})).toBeVisible();
  expect(await player.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 }finally{await hostContext.request.delete(baseURL+`/api/decks/${deck.id}`);await hostContext.close();await playerContext.close();}
});
