/**
 * Opt-in browser E2E test. Requires a migrated disposable PostgreSQL instance,
 * a running dev server, and @playwright/test installed. NOT part of default CI.
 */
import { test, expect } from "@playwright/test";

test("author, reopen and study MCQ, matching and image hotspot on desktop/mobile", async ({page}) => {
  const base=process.env.BASE_URL ?? "http://localhost:5000";
  const svg='<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200"><rect width="400" height="200" fill="#ddd"/><circle cx="200" cy="100" r="30" fill="blue"/></svg>';
  await page.route("https://fixture.invalid/diagram.png", route =>
    route.fulfill({status:200, contentType:"image/svg+xml", body:svg}));
  let deckId:number|undefined;
  try {
    const account=await page.request.post(base+"/api/auth/register",{data:{email:`visual-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`,password:"Browser-test-passphrase-2026"}});
    expect(account.status()).toBe(201);
    await page.goto(base+"/new-exam");
    await page.getByLabel("Title").fill("Phase 2 E2E "+Date.now());
    await page.getByRole("button",{name:"Create deck and open builder"}).click();
    await expect(page).toHaveURL(/\/exam-builder\/\d+/);
    deckId=Number(page.url().match(/exam-builder\/(\d+)/)?.[1]);
    expect(deckId).toBeGreaterThan(0);

    await page.getByLabel("Question prompt").fill("Pick the second option");
    await page.getByLabel("Choice 1 text").fill("Wrong");
    await page.getByLabel("Choice 2 text").fill("Right");
    await page.getByLabel("Choice 2 is correct").check();
    await page.getByRole("button",{name:"Save question"}).click();
    await expect(page.getByText("1. Pick the second option")).toBeVisible();

    await page.getByLabel("Question type").selectOption("matching");
    await page.getByLabel("Question prompt").fill("Match languages");
    await page.getByLabel("Pair 1 prompt").fill("uno");
    await page.getByLabel("Pair 1 match").fill("one");
    await page.getByLabel("Pair 2 prompt").fill("dos");
    await page.getByLabel("Pair 2 match").fill("two");
    await page.getByRole("button",{name:"Save question"}).click();
    await expect(page.getByText("2. Match languages")).toBeVisible();

    await page.getByLabel("Question type").selectOption("image_hotspot");
    await page.getByLabel("Question prompt").fill("Find the central point");
    await page.getByLabel("Public HTTPS image URL").fill("https://fixture.invalid/diagram.png");
    await page.getByLabel("Diagram description (for accessibility)").fill("Blue circle centered on gray");
    await page.getByRole("button",{name:"Add target at center"}).click();
    await page.getByLabel("Target 1 label").fill("Center");
    await page.getByRole("button",{name:"Save question"}).click();
    await expect(page.getByText("3. Find the central point")).toBeVisible();

    await page.reload();
    await expect(page.getByText("Saved questions (3)")).toBeVisible();
    await page.setViewportSize({width:375,height:812});
    await page.getByRole("button",{name:"Practice visual questions"}).click();

    await page.getByLabel("Right").check();
    await page.getByRole("button",{name:"Check answer"}).click();
    await expect(page.getByText("Correct!")).toBeVisible();
    await page.getByRole("button",{name:"Next question"}).click();

    await page.getByLabel("uno").selectOption("one");
    await page.getByLabel("dos").selectOption("two");
    await page.getByRole("button",{name:"Check answer"}).click();
    await expect(page.getByText("Correct!")).toBeVisible();
    await page.getByRole("button",{name:"Next question"}).click();

    const region=page.getByRole("button",{name:"Region 1",exact:true});
    await region.focus();
    await region.press("Enter");
    await page.getByRole("button",{name:"Check answer"}).click();
    await expect(page.getByText("Correct!")).toBeVisible();
    await page.getByRole("button",{name:"Show results"}).click();
    await expect(page.getByText("3 of 3 graded correct.")).toBeVisible();
  } finally {
    if(deckId)await page.request.delete(base+`/api/decks/${deckId}`);
  }
});
