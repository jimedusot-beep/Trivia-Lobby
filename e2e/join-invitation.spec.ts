import { test, expect } from "@playwright/test";

test("direct invitation links prefill the valid room code without requiring login", async ({ page }) => {
  await page.goto("/join?code=ABC234");
  await expect(page.getByLabel("Room Code")).toHaveValue("ABC234");
  await expect(page.getByLabel("Your Name")).toBeVisible();
  await expect(page.getByRole("button",{name:"Enter Game"})).toBeDisabled();
  await page.getByLabel("Your Name").fill("Guest");
  await expect(page.getByRole("button",{name:"Enter Game"})).toBeEnabled();
});

test("invalid invitation codes are not prefilled", async ({ page }) => {
  await page.goto("/join?code=INVALID");
  await expect(page.getByLabel("Room Code")).toHaveValue("");
});
