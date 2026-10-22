/**
 * Real browser + PostgreSQL exercise for Phase 4. Run against an isolated migrated
 * disposable DB and a running server. Two independent browser contexts model devices.
 */
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";

test("adaptive cards survive reload and second-device login without leaking to another account", async ({ browser }) => {
  const base = process.env.BASE_URL ?? "http://127.0.0.1:5000";
  const suffix = randomUUID();
  const email = `study-e2e-${suffix}@example.com`;
  const strangerEmail = `unrelated-${suffix}@example.com`;
  const password = "correct-horse-battery-2026";
  const question = `Unique recall prompt ${suffix}?`;
  let deckId: number | null = null;
  const first = await browser.newContext();
  const second = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const other = await browser.newContext();
  const pageA = await first.newPage();
  const pageB = await second.newPage();
  const pageOther = await other.newPage();
  const signup = async (page: typeof pageA, address: string) => {
    await page.goto(base + "/learning");
    await page.getByRole("button", { name: "Need an account? Register" }).click();
    await page.getByLabel("Email").fill(address);
    await page.getByLabel(/Password/).fill(password);
    await Promise.all([page.waitForEvent("domcontentloaded"), page.getByRole("button", { name: "Create account", exact:true }).click()]);
    await expect(page.getByRole("heading", { name: "My learning" })).toBeVisible();
  };
  try {
    await signup(pageA,email);
    await pageA.goto(base+"/");
    const accessibility=await new AxeBuilder({page:pageA}).withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze();
    expect(accessibility.violations.filter(v=>["serious","critical"].includes(v.impact??""))).toEqual([]);
    const created = await pageA.request.post(base + "/api/decks/import", {
      data: { deck: { title: "Adaptive browser test " + suffix, category: "Browser Recall" },
        cards: [
          { type: "flashcard", front: question, back: "A persisted response" },
          { type: "flashcard", front: "Follow-up " + suffix, back: "Another response" },
        ] },
    });
    expect(created.status()).toBe(201);
    deckId = (await created.json()).id;
    await pageA.goto(base + `/learning/review/${deckId}?mode=due`);
    await expect(pageA.getByRole("heading", { name: question })).toBeVisible();
    await pageA.getByRole("button", { name: "Reveal answer" }).click();
    await expect(pageA.getByText("A persisted response")).toBeVisible();
    await Promise.all([pageA.waitForResponse(r=>r.url().endsWith("/api/study/review")&&r.request().method()==="POST"),pageA.getByRole("button", { name: "Again" }).click()]);
    await pageA.goto(base + "/learning");
    await expect(pageA.getByRole("heading", { name: "Wrong-answer notebook" })).toBeVisible();
    await expect(pageA.getByText(question)).toBeVisible();
    await pageA.reload();
    await expect(pageA.getByText(question)).toBeVisible();

    // One identity, a second cookie jar/device: private history and review queue reload.
    await pageB.goto(base + "/learning");
    await pageB.getByLabel("Email").fill(email);
    await pageB.getByLabel(/Password/).fill(password);
    await Promise.all([pageB.waitForEvent("domcontentloaded"), pageB.getByRole("button", { name: "Sign in", exact: true }).click()]);
    await expect(pageB.getByRole("heading", { name: "My learning" })).toBeVisible();
    await expect(pageB.getByText(question)).toBeVisible();
    expect(await pageB.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
    await pageB.goto(base + `/learning/review/${deckId}?mode=missed`);
    await expect(pageB.getByRole("heading", { name: question })).toBeVisible();
    await pageB.getByRole("button", { name: "Reveal answer" }).click();
    await pageB.getByRole("button", { name: "Good" }).click();
    await expect(pageB.getByRole("heading", { name: "Queue complete" })).toBeVisible();

    // After a second-device review, the first device sees the updated saved state.
    await pageA.reload();
    await expect(pageA.getByText("No unresolved weak cards in this subject.")).toBeVisible();

    // Different authenticated account must not inherit the history of the first.
    await signup(pageOther, strangerEmail);
    await expect(pageOther.getByText("No unresolved weak cards in this subject.")).toBeVisible();
    await pageOther.goto(base + `/learning/review/${deckId}?mode=missed`);
    await expect(pageOther.getByRole("heading", { name: "Queue complete" })).toBeVisible();

    // A server-graded visual/universal question must surface in the private
    // notebook with the visual practice retry route, not another user's page.
    const visualPrompt="Visual missed question " + suffix;
    const visualCreated=await pageA.request.post(base+`/api/decks/${deckId}/questions`,{data:{
      schemaVersion:1,prompt:visualPrompt,answer:{kind:"multiple_choice",
        options:[{id:"A",label:"Correct"},{id:"B",label:"Incorrect"}],correctOptionIds:["A"]},
    }});
    expect(visualCreated.status()).toBe(201);
    const visualId=(await visualCreated.json()).id;
    const visualCheck=await pageA.request.post(base+`/api/decks/${deckId}/questions/${visualId}/check`,{
      data:{response:{selectedIds:["B"]},requestId:randomUUID()},
    });
    expect(visualCheck.status()).toBe(200);
    expect((await visualCheck.json()).correct).toBe(false);
    await pageA.goto(base+"/learning");
    const visualRow=pageA.getByRole("listitem").filter({hasText:visualPrompt});
    await expect(visualRow).toBeVisible();
    await expect(visualRow.getByRole("link",{name:"Retry"}))
      .toHaveAttribute("href",`/visual-practice/${deckId}?mode=adaptive`);
    await pageOther.reload();
    await expect(pageOther.getByText(visualPrompt)).toHaveCount(0);

    await pageA.goto(base+`/practice/${deckId}`);
    await pageA.getByRole("button",{name:"Reveal answer",exact:true}).click();
    await pageA.getByRole("button",{name:"I knew it",exact:true}).click();
    await expect(pageA.getByText("Review saved",{exact:true})).toBeVisible();
    await pageA.goto(base+`/flashcards/${deckId}`);
    const flip=pageA.getByRole("button",{name:"Flip flashcard",exact:true});await flip.focus();await pageA.keyboard.press("Enter");
    await expect(flip).toHaveAttribute("aria-pressed","true");
    await Promise.all([pageA.waitForResponse(r=>r.url().endsWith("/api/study/review")&&r.request().method()==="POST"),pageA.getByRole("button",{name:"Got It!",exact:true}).click()]);
    const savedPractice=await pageA.request.get(base+"/api/study/history");
    expect((await savedPractice.json()).events.length).toBe(4);
    const blocked = await pageA.request.post(base+"/api/study/review",{headers:{Origin:"https://untrusted.example"},data:{cardId:1,rating:1,requestId:randomUUID()}});
    expect(blocked.status()).toBe(403);
    const history=await pageOther.request.get(base+"/api/study/history");
    expect((await history.json()).events).toEqual([]);
  } finally {
    if (deckId !== null) await pageA.request.delete(base + `/api/decks/${deckId}`).catch(() => {});
    await first.close(); await second.close(); await other.close();
  }
});
