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
console.log("HTTP, database readiness and WebSocket smoke checks passed");
