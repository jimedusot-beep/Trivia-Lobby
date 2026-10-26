import { test, expect } from "@playwright/test";

async function room(browser, dropAck = false) {
  const contexts = [], hostContext = await browser.newContext(); contexts.push(hostContext);
  let acknowledgments = 0;
  const host = await hostContext.newPage(); await host.goto("http://127.0.0.1:4317/");
  await host.getByRole("button", { name: "Create host screen", exact: true }).click();
  await expect(host.locator("#heading")).toContainText("lobby");
  const code = (await host.locator("#heading").innerText()).split(" · ")[0], players = [];
  for (let i = 0; i < 3; i++) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } }); contexts.push(context);
    if (dropAck && i === 0) await context.routeWebSocket("**/socket", route => {
      const server = route.connectToServer();
      server.onMessage(message => {
        const frame = JSON.parse(typeof message === "string" ? message : message.toString());
        if (frame.type === "ack" && ++acknowledgments === 1) return;
        route.send(message);
      });
    });
    const page = await context.newPage(); await page.goto(`http://127.0.0.1:4317/?code=${code}`);
    await page.getByLabel("Nickname", { exact: true }).fill(`Recovery ${i}`);
    await page.getByRole("button", { name: "Join party", exact: true }).click();
    await expect(page.locator("#heading")).toHaveText(`${code} · lobby`); players.push(page);
  }
  return { host, players, code, get acknowledgments() { return acknowledgments; }, close: () => Promise.all(contexts.map(context => context.close())) };
}

test("a phone recovers on restored connectivity without creating a duplicate player", async ({ browser }) => {
  const game = await room(browser);
  try {
    await game.host.getByRole("button", { name: "Start match", exact: true }).click();
    await expect(game.players[0].locator("#heading")).toContainText("question");
    const reconnect = game.players[0].waitForEvent("websocket");
    await game.players[0].evaluate(() => window.dispatchEvent(new Event("online")));
    const socket = await reconnect;
    await socket.waitForEvent("framereceived", { predicate: event => {
      const frame = JSON.parse(String(event.payload)); return frame.type === "state";
    } });
    await expect(game.players[0].locator("#status")).toHaveText("Party ready.");
    await expect(game.host.locator("#roster li")).toHaveCount(3);
    for (const player of game.players) await player.getByRole("button", { name: "Triangle", exact: true }).click();
    await expect(game.host.locator("#heading")).toContainText("reveal");
    await expect(game.host.locator("#roster li").filter({ hasText: "Recovery 0" })).toContainText("100 points");
  } finally { await game.close(); }
});

test("a dropped answer acknowledgment retries the original command without awarding twice", async ({ browser }) => {
  const game = await room(browser, true);
  try {
    await game.host.getByRole("button", { name: "Start match", exact: true }).click();
    await expect(game.players[0].locator("#heading")).toContainText("question");
    await game.players[0].getByRole("button", { name: "Triangle", exact: true }).click();
    await expect.poll(() => game.acknowledgments).toBe(2);
    for (const player of game.players.slice(1)) await player.getByRole("button", { name: "Triangle", exact: true }).click();
    await expect(game.host.locator("#heading")).toContainText("reveal");
    for (let i = 0; i < 3; i++) await expect(game.host.locator("#roster li").filter({ hasText: `Recovery ${i}` })).toContainText("100 points");
  } finally { await game.close(); }
});
