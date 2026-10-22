import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("join flow has labeled keyboard controls, no serious automated accessibility findings and fits a phone",async({page})=>{
 await page.setViewportSize({width:375,height:812});await page.goto("/join");
 await page.getByLabel("Room Code").focus();await page.keyboard.type("ABC234");await page.keyboard.press("Tab");
 await expect(page.getByLabel("Your Name")).toBeFocused();await page.keyboard.type("Keyboard player");
 await page.keyboard.press("Tab");await expect(page.getByRole("button",{name:"Enter Game"})).toBeFocused();
 const report=await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze();
 expect(report.violations.filter(v=>["serious","critical"].includes(v.impact??""))).toEqual([]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
