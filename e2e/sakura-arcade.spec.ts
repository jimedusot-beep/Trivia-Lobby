import { test, expect } from "@playwright/test";

test("Sakura Arcade homepage keeps four keyboard-accessible routes and original guest onboarding",async({page,request})=>{
  await page.goto("/");
  await expect(page.getByRole("heading",{name:"Play together. Learn for fun."})).toBeVisible();
  const menu=page.getByRole("navigation",{name:"Arcade main menu"});
  await expect(menu.getByRole("link")).toHaveCount(4);
  await expect(menu.getByRole("link",{name:/PLAY GAMES/})).toHaveAttribute("href","/party/");
  await expect(menu.getByRole("link",{name:/JOIN PARTY/})).toHaveAttribute("href","/party/#join-entry");
  await expect(menu.getByRole("link",{name:/CREATE/})).toHaveAttribute("href","/party/create.html");
  await expect(menu.getByRole("link",{name:/LEARN/})).toHaveAttribute("href","/party/learn.html");
  await expect(page.getByRole("link",{name:/Try a Lesson/})).toBeVisible();
  await menu.getByRole("link",{name:/PLAY GAMES/}).focus();
  await expect(menu.getByRole("link",{name:/PLAY GAMES/})).toBeFocused();
  expect(await page.locator("html").evaluate(node=>getComputedStyle(node).getPropertyValue("--sakura-pink").trim())).toBe("#f5a9c4");
  const art=await request.get("/party/sakura-vista.svg");
  expect(art.ok()).toBeTruthy();
  expect(await art.text()).toContain("<svg");
});
test("Sakura console and guest entry fit a 375px phone with reduced motion",async({page})=>{
  await page.setViewportSize({width:375,height:812});
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.goto("/");
  await expect(page.getByRole("navigation",{name:"Arcade main menu"})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.goto("/party/");
  await expect(page.getByRole("button",{name:"Create host screen"})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
