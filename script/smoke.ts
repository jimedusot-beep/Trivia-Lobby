import { WebSocket } from "ws";

const origin = new URL(process.env.SMOKE_URL ?? "http://127.0.0.1:5000");
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Render Free cold-starts in approximately a minute after 15 idle minutes.
 * Retry only transient failures; never mask permanent HTTP 4xx failures.
 */
async function expectHealthy(path: string, maxWaitMs: number) {
  const deadline = Date.now() + maxWaitMs;
  let last = "no response";
  while (Date.now() < deadline) {
    try {
      const res = await fetch(new URL(path, origin), {
        signal: AbortSignal.timeout(15000), cache: "no-store",
      });
      if (res.ok) return;
      if (res.status >= 400 && res.status < 500) throw new Error(path + " refused with HTTP " + res.status);
      last = "HTTP " + res.status;
    } catch (error) {
      if (error instanceof Error && error.message.includes("refused with HTTP")) throw error;
      last = error instanceof Error ? error.name : "network failure";
    }
    await pause(Math.min(3000, Math.max(0, deadline - Date.now())));
  }
  throw new Error(path + " did not become healthy within " + maxWaitMs/1000 + " seconds (" + last + ")");
}

await expectHealthy("/health/live", 120000);
await expectHealthy("/health/ready", 90000);

const socketUrl = new URL("/ws", origin);
socketUrl.protocol = origin.protocol === "https:" ? "wss:" : "ws:";
await new Promise<void>((resolve, reject) => {
  const ws = new WebSocket(socketUrl, { origin: origin.origin });
  const timer = setTimeout(() => {
    ws.terminate();
    reject(new Error("WebSocket smoke timed out"));
  }, 30000);
  ws.once("open", () => ws.send(JSON.stringify({ v: 1, type: "start_game", payload: {} })));
  ws.once("message", raw => {
    try {
      const data = JSON.parse(raw.toString());
      if (data.type !== "error") throw new Error("Unexpected smoke response");
      clearTimeout(timer);
      ws.close();
      resolve();
    } catch (error) {
      clearTimeout(timer);
      ws.terminate();
      reject(error);
    }
  });
  ws.once("error", error => {
    clearTimeout(timer);
    reject(error);
  });
});
// Anonymous clients cannot create a host-owned game room on the public server.
await new Promise<void>((resolve, reject) => {
  const ws = new WebSocket(socketUrl, { origin: origin.origin });
  const timer = setTimeout(() => { ws.terminate(); reject(new Error("Anonymous host check timed out")); }, 15_000);
  ws.once("open", () => ws.send(JSON.stringify({ v: 1, type: "create_room", payload: { deckId: 1 } })));
  ws.once("message", raw => {
    try {
      const result = JSON.parse(raw.toString());
      if (result.type !== "error" || !/sign in required/i.test(result.payload?.message ?? "")) throw new Error("Anonymous host creation was not rejected");
      clearTimeout(timer); ws.close(); resolve();
    } catch (err) { clearTimeout(timer); ws.terminate(); reject(err); }
  });
  ws.once("error", err => { clearTimeout(timer); reject(err); });
});
// Production-safe checks: these requests do not create accounts, quizzes or rooms.
const publicPage = await fetch(new URL("/", origin), { signal: AbortSignal.timeout(15_000) });
if (publicPage.status !== 200 || !(publicPage.headers.get("content-type") ?? "").includes("text/html")) throw new Error("Public frontend is not serving HTML");
const pageHtml = await publicPage.text();
if (!pageHtml.includes('id="root"') || !pageHtml.includes("Trivia Lobby")) throw new Error("Public frontend is not the Trivia Lobby application");
for (const path of ["/api/auth/me", "/api/decks", "/api/assignments"]) {
  const res = await fetch(new URL(path, origin), { signal: AbortSignal.timeout(15_000) });
  if (res.status !== 401 || !(res.headers.get("content-type") ?? "").includes("application/json")) throw new Error(path + " must reject anonymous users with JSON 401");
  if (res.headers.get("x-content-type-options") !== "nosniff" || !(res.headers.get("cache-control") ?? "").includes("no-store")) throw new Error(path + " must disable private response caching and content sniffing");
}
for (const path of ["/api/__smoke_missing__", "/assets/__smoke_missing__.js"]) {
  const res = await fetch(new URL(path, origin), { signal: AbortSignal.timeout(15_000) });
  if (res.status !== 404 || !(res.headers.get("content-type") ?? "").includes("application/json")) throw new Error(path + " must not fall back to private or SPA content");
}
const crossSite = await fetch(new URL("/api/decks", origin), {
  method: "POST", headers: { "content-type": "application/json", origin: "https://external-test.invalid", "sec-fetch-site": "cross-site" },
  body: "{}", signal: AbortSignal.timeout(15_000),
});
if (crossSite.status !== 403) throw new Error("Cross-site API mutation was not blocked");
console.log("Public UI, HTTP/DB readiness, private API safeguards and WebSocket smoke passed");
