import { test,expect } from "@playwright/test";
test("imported cards can be corrected and reordered without another upload",async({page,baseURL})=>{
 const account=await page.request.post(baseURL+"/api/auth/register",{data:{email:`editor-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`,password:"Editor-test-passphrase-2026"}});expect(account.status()).toBe(201);
 const imported=await page.request.post(baseURL+"/api/decks/import",{data:{deck:{title:"Editable cards"},cards:[{front:"Original prompt",back:"Before",type:"flashcard"},{front:"Second prompt",back:"Other",type:"flashcard"}]}});expect(imported.status()).toBe(201);const deck=await imported.json();
 try{
  await page.goto(baseURL+`/card-editor/${deck.id}`);await page.getByRole("button",{name:"1. Original prompt",exact:true}).click();
  await page.getByLabel("Question",{exact:true}).fill("Corrected prompt");await page.getByLabel("Answer or explanation",{exact:true}).fill("Correct answer");
  await page.getByRole("button",{name:"Save changes",exact:true}).click();await expect(page.getByRole("button",{name:"1. Corrected prompt",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Move card 1 down",exact:true}).click();await expect(page.getByRole("button",{name:"2. Corrected prompt",exact:true})).toBeVisible();
  await page.reload();await expect(page.getByRole("button",{name:"2. Corrected prompt",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"2. Corrected prompt",exact:true}).click();await expect(page.getByLabel("Answer or explanation",{exact:true})).toHaveValue("Correct answer");
 }finally{await page.request.delete(baseURL+`/api/decks/${deck.id}`,{timeout:5000}).catch(()=>{});}
});
