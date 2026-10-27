import {test,expect} from "@playwright/test";
test("Sakura game shelf previews modes without starting them",async({page})=>{
 await page.goto("http://127.0.0.1:4317");
 await expect(page.locator("#status")).toHaveText("Connected.");
 const picker=page.locator("#game-picker");
 const spotlight=page.getByRole("region",{name:"Selected game preview"});
 await expect(spotlight.getByRole("heading",{name:"Trivia Quiz"})).toBeVisible();
 await picker.getByRole("button",{name:"Preview Family Bingo"}).click();
 await expect(spotlight.getByRole("heading",{name:"Family Bingo"})).toBeVisible();
 await expect(spotlight).toContainText("20 calls");
 await expect(picker.getByRole("button",{name:"Preview Family Bingo"})).toHaveAttribute("aria-pressed","true");
 await expect(page.locator("#entry")).toBeVisible();
 await picker.getByRole("button",{name:"Board games",exact:true}).click();
 await expect(spotlight.getByRole("heading")).not.toHaveText("Family Bingo");
 await expect(picker.locator(".pick-game-card:not([hidden])").first()).toBeVisible();
 await picker.getByRole("button",{name:"All games",exact:true}).click();
 await expect(picker.getByRole("button",{name:/Host Family Bingo/})).toBeVisible();
});
