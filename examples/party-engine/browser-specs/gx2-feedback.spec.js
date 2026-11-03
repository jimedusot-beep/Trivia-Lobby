import {test,expect} from "@playwright/test";
test("opt-in feedback demo has no autoplay, accessible controls and seven cues",async({page})=>{
  await page.goto("/gx2-feedback-demo.html");
  await expect(page.getByRole("heading",{name:"Feedback laboratory"})).toBeVisible();
  await expect(page.locator("#cue-grid button")).toHaveCount(7);
  await expect(page.locator("#mute")).toBeChecked();
  await expect(page.locator("#status")).toContainText("locked");
  await page.getByRole("button",{name:"Confirmed"}).click();
  await expect(page.locator("#feedback")).toHaveText("Confirmed");
  await expect(page.locator("#status")).toContainText("Visual only");
  await page.getByRole("button",{name:"Start another round"}).click();
  await expect(page.locator("#feedback")).toBeEmpty();
  await page.locator("#low-power").check();
  await page.getByRole("button",{name:"Boost"}).click();
  await expect(page.locator("#feedback")).toHaveAttribute("data-gx2-motion","off");
  await page.reload();
  await expect(page.locator("#low-power")).toBeChecked();
  await expect(page.locator("#mute")).toBeChecked();
});
