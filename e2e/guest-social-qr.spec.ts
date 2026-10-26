import { expect, test } from "@playwright/test";

test("same-origin QR code opens guest lobby with public room code only",async({page,request,baseURL})=>{
 await page.goto("/party/");
 await page.getByRole("button",{name:"Create host screen"}).click();
 await expect(page.locator("#heading")).toContainText("lobby");
 const code=(await page.locator("#heading").innerText()).split(" · ")[0];
 const qr=page.getByRole("img",{name:new RegExp("Scan QR code to join party")});
 await expect(qr).toBeVisible();
 await expect.poll(async()=>qr.evaluate(img=>(img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
 const path="/party/join-qr.svg?code="+encodeURIComponent(code)+"&origin="+encodeURIComponent(new URL(baseURL!).origin);
 const response=await request.get(path);
 expect(response.status()).toBe(200);
 expect(response.headers()["content-type"]).toContain("image/svg+xml");
 const svg=await response.text();
 expect(svg).toContain("Scan to join party "+code);
 expect(svg).toContain("<path");
 expect(svg).not.toContain("token=");
 const badCode=await request.get("/party/join-qr.svg?code=INJECT&origin="+encodeURIComponent(new URL(baseURL!).origin));
 expect(badCode.status()).toBe(400);
 const badOrigin=await request.get("/party/join-qr.svg?code="+code+"&origin="+encodeURIComponent("https://evil.example"));
 expect(badOrigin.status()).toBe(400);
});
