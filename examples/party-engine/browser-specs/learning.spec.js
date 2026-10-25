import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function createCourse(page, count = 6) {
  await page.goto("/create.html");
  const content = "Question,OptionA,OptionB,Correct,Explanation\n" +
    Array.from({ length: count }, (_, i) => `Question ${i + 1}?,Right answer,Wrong answer,A,Explanation ${i + 1}.`).join("\n");
  await page.locator("#import-file").setInputFiles({ name: "My-course.csv", mimeType: "text/csv", buffer: Buffer.from(content) });
  await expect(page.locator("#status")).toContainText(`Imported ${count} questions`);
  await page.getByRole("button", { name: "Save & learn", exact: true }).click();
  await expect(page).toHaveURL(/\/learn.html\?deck=/);
  await expect(page.locator("#course-title")).toHaveText("My course");
}
async function answer(page, wrong = false) {
  await page.getByRole("button", { name: wrong ? "B. Wrong answer" : "A. Right answer", exact: true }).click();
  await expect(page.locator("#feedback")).toBeVisible();
  await page.locator("#continue").click();
}
async function finish(page, count) {
  for (let i = 0; i < count; i++) await answer(page);
  await expect(page.locator("#summary")).toBeVisible();
}

test("own quiz becomes a guest course with reload recovery, retries, unlocks, achievements and no duplicate replay XP", async ({ page }) => {
  await createCourse(page);
  await expect(page.getByLabel("Email")).toHaveCount(0);
  await expect(page.locator("#path button").nth(1)).toBeDisabled();
  await page.locator("#daily").click();
  await page.getByRole("button", { name: "B. Wrong answer", exact: true }).click();
  await expect(page.locator("#answer-explanation")).toContainText("Right answer. Explanation 1.");
  await page.reload();
  await page.getByRole("button", { name: "Resume Lesson 1", exact: true }).click();
  await expect(page.locator("#feedback")).toBeVisible();
  await expect(page.locator("#choices button").nth(0)).toBeDisabled();
  await expect(page.locator("#choices button").nth(1)).toBeDisabled();
  await page.locator("#continue").click();
  for (let i = 0; i < 4; i++) await answer(page);
  await expect(page.locator("#question-position")).toContainText("Retry 1 of 1");
  await finish(page, 1);
  await expect(page.locator("#score")).toHaveText("First try: 4 of 5 correct.");
  await expect(page.locator("#retry-score")).toContainText("On retry: 1 of 1 corrected");
  await expect(page.locator("#xp")).toHaveText("45 practice XP");
  await expect(page.locator("#daily-goal")).toContainText("complete");
  await expect(page.locator("#streak")).toHaveText("1-day streak");
  await expect(page.locator("#achievements .earned")).toContainText(["First lesson"]);
  await page.locator("#next-lesson").click(); await finish(page, 1);
  await expect(page.locator("#xp")).toHaveText("60 practice XP");
  await expect(page.locator("#achievements .earned")).toContainText(["First lesson", "Course finisher"]);
  await page.locator("#path button").first().click(); await finish(page, 5);
  await expect(page.locator("#xp")).toHaveText("60 practice XP");
  await expect(page.locator("#path button").first()).toContainText("Best first try: 5/5");
  await page.reload(); await expect(page.locator("#xp")).toHaveText("60 practice XP");
  await expect(page.locator("#course-progress")).toHaveText("2 / 2 lessons complete");
});

test("learning backup restores quizzes on a fresh device and reimport preserves newer completions", async ({ page, browser }) => {
  await createCourse(page);
  await page.locator("#daily").click(); await finish(page, 5);
  await page.locator(".backup summary").click();
  const downloadPromise = page.waitForEvent("download"); await page.locator("#export").click();
  const data = await readFile(await (await downloadPromise).path());
  const context = await browser.newContext();
  try {
    const restored = await context.newPage();
    await restored.goto("/learn.html"); await expect(restored.locator("#empty")).toBeVisible();
    await restored.locator(".backup summary").click();
    const file = { name: "learning.json", mimeType: "application/json", buffer: data };
    await restored.locator("#restore").setInputFiles(file);
    await expect(restored.locator("#status")).toContainText("Restored 1 quizzes");
    await expect(restored.locator("#xp")).toHaveText("55 practice XP");
    await restored.locator("#daily").click(); await finish(restored, 1);
    await expect(restored.locator("#xp")).toHaveText("70 practice XP");
    await restored.locator("#restore").setInputFiles(file);
    await expect(restored.locator("#status")).toContainText("Restored 1 quizzes");
    await expect(restored.locator("#xp")).toHaveText("70 practice XP");
    await expect(restored.locator("#course-progress")).toContainText("2 / 2");
    await restored.reload(); await expect(restored.locator("#xp")).toHaveText("70 practice XP");
  } finally { await context.close(); }
});

test("invalid and conflicting backups leave quizzes and progress intact, with no partial quiz insert", async ({ page }) => {
  await createCourse(page, 1);
  await page.locator("#daily").click(); await finish(page, 1);
  await page.locator(".backup summary").click();
  await page.locator("#restore").setInputFiles({ name: "bad.json", mimeType: "application/json", buffer: Buffer.from('{"users":["private"]}') });
  await expect(page.locator("#status")).toContainText("Choose a Trivia Lobby learning backup");
  const backup = await page.evaluate(async () => {
    const { listGuestDecks } = await import("./guest-decks.js");
    const { learningBackup } = await import("./guest-learning.js");
    const { loadLearningProgress } = await import("./guest-learning-store.js");
    const decks = await listGuestDecks(), first = structuredClone(decks[0]);
    first.id = crypto.randomUUID(); first.title = "Must not be partly inserted";
    const conflict = { ...decks[0], title: "Conflicting quiz" };
    return learningBackup([first, conflict], await loadLearningProgress());
  });
  await page.locator("#restore").setInputFiles({ name: "conflict.json", mimeType: "application/json", buffer: Buffer.from(backup) });
  await expect(page.locator("#status")).toContainText("No quizzes were changed");
  const titles = await page.evaluate(async () => (await (await import("./guest-decks.js")).listGuestDecks()).map(d => d.title));
  expect(titles).toEqual(["My course"]);
  await expect(page.locator("#xp")).toHaveText("15 practice XP");
});

test("editing course questions starts a fresh path while keeping historical XP and achievements", async ({ page }) => {
  await createCourse(page, 1); await page.locator("#daily").click(); await finish(page, 1);
  await page.evaluate(async () => {
    const { listGuestDecks, saveGuestDeck } = await import("./guest-decks.js");
    const [deck] = await listGuestDecks(); deck.questions[0].prompt = "A changed question?";
    await saveGuestDeck(deck);
  });
  await page.reload();
  await expect(page.locator("#version-note")).toContainText("quiz questions changed");
  await expect(page.locator("#course-progress")).toContainText("0 / 1");
  await expect(page.locator("#xp")).toHaveText("15 practice XP");
  await expect(page.locator("#achievements .earned")).toContainText(["First lesson", "Course finisher"]);
  await page.locator("#daily").click(); await expect(page.locator("#lesson-heading")).toHaveText("A changed question?");
});

test("two tabs deduplicate rewards and preserve independent course completions atomically", async ({ page, context }) => {
  await createCourse(page, 1);
  const other = await context.newPage(); await other.goto("/learn.html");
  const complete = async target => target.evaluate(async () => {
    const { listGuestDecks } = await import("./guest-decks.js");
    const model = await import("./guest-learning.js"), store = await import("./guest-learning-store.js");
    const course = await model.courseFromDeck((await listGuestDecks())[0]);
    let session = model.newSession(course, 0);
    session = model.answerSession(course, session, 0); session = model.advanceSession(course, session);
    return (await store.finishLearningSession(course, session)).earnedXP;
  });
  expect((await Promise.all([complete(page), complete(other)])).sort((a, b) => a - b)).toEqual([0, 15]);
  await page.evaluate(async () => {
    const { listGuestDecks, saveGuestDeck } = await import("./guest-decks.js");
    const [deck] = await listGuestDecks(); await saveGuestDeck({ ...deck, id: crypto.randomUUID(), title: "Another course" });
  });
  await Promise.all([complete(page), complete(other)]);
  await page.reload(); await expect(page.locator("#xp")).toHaveText("30 practice XP");
  await expect(page.locator("#lesson-count")).toHaveText("2");
});

test("storage failure keeps lessons usable and marks progress as session-only", async ({ page }) => {
  await createCourse(page, 1);
  await page.addInitScript(() => {
    const original = IDBFactory.prototype.open;
    IDBFactory.prototype.open = function(name, version) {
      if (name === "trivia-lobby-local-learning") throw new DOMException("Storage denied", "SecurityError");
      return original.call(this, name, version);
    };
  });
  await page.reload();
  await expect(page.locator("#storage-note")).toContainText("page session only");
  await page.locator("#daily").click(); await finish(page, 1);
  await expect(page.locator("#xp")).toHaveText("15 practice XP");
  await expect(page.locator("#earned-xp")).toContainText("page session only");
  await page.reload(); await expect(page.locator("#xp")).toHaveText("0 practice XP");
});

test("corrupt saved progress is reported and never overwritten by fallback practice", async ({ page }) => {
  await createCourse(page, 1);
  await page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open("trivia-lobby-local-learning", 1);
    request.onsuccess = () => {
      const db = request.result, tx = db.transaction("records", "readwrite");
      tx.objectStore("records").put({ key: "progress", value: { version: 999 } });
      tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error);
    };
  }));
  await page.reload(); await expect(page.locator("#storage-note")).toContainText("Existing saved progress was kept");
  await page.locator("#daily").click(); await finish(page, 1);
  const saved = await page.evaluate(() => new Promise(resolve => {
    const request = indexedDB.open("trivia-lobby-local-learning", 1);
    request.onsuccess = () => {
      const db = request.result, tx = db.transaction("records", "readonly");
      const get = tx.objectStore("records").get("progress");
      get.onsuccess = () => resolve(get.result.value); tx.oncomplete = () => db.close();
    };
  }));
  expect(saved).toEqual({ version: 999 });
});

test("course and feedback support keyboard focus and narrow screens", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await createCourse(page, 1);
  await page.locator("#daily").focus(); await page.keyboard.press("Enter");
  await expect(page.locator("#lesson-heading")).toBeFocused();
  await page.keyboard.press("Tab"); await expect(page.getByRole("button", { name: "A. Right answer" })).toBeFocused();
  await page.keyboard.press("Enter"); await expect(page.locator("#continue")).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.keyboard.press("Enter"); await expect(page.locator("#summary-heading")).toBeFocused();
});
