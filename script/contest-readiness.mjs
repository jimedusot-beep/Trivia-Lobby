// Read-only verification of the publicly deployed guest multiplayer demo.
// No rooms, users, quiz decks, or database records are created.
import { appendFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const DEFAULT_URL = "https://trivia-lobby.onrender.com";

export function validateContestUrl(raw) {
  const target = new URL(raw);
  if (target.protocol !== "https:" || target.hostname !== "trivia-lobby.onrender.com" ||
      target.username || target.password || target.search || target.hash ||
      (target.pathname !== "/" && target.pathname !== "")) {
    throw new Error("Contest readiness only checks https://trivia-lobby.onrender.com");
  }
  return target;
}

async function getResponse(target, path, fetchImpl, retryMs = 0) {
  const deadline = Date.now() + retryMs;
  let lastError;
  do {
    try {
      const response = await fetchImpl(new URL(path, target), {
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(15_000),
      });
      if (response.ok) return response;
      if (response.status >= 400 && response.status < 500) {
        throw new Error(path + " returned non-retryable HTTP " + response.status);
      }
      lastError = new Error(path + " returned HTTP " + response.status);
    } catch (error) {
      if (error instanceof Error && /non-retryable/.test(error.message)) throw error;
      lastError = error;
    }
    if (Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, Math.min(3000, deadline - Date.now())));
    }
  } while (Date.now() < deadline);
  throw new Error(path + " did not respond successfully: " + (lastError instanceof Error ? lastError.message : "unknown failure"));
}

export async function checkContestDemo({
  url = DEFAULT_URL,
  expectedSha = "",
  fetchImpl = fetch,
  retryHealthMs = 120_000,
} = {}) {
  const target = validateContestUrl(url);
  if (expectedSha && !/^[0-9a-f]{40}$/.test(expectedSha)) {
    throw new Error("EXPECTED_DEPLOYED_SHA must be a lowercase 40-character Git SHA");
  }

  // Wake sleeping free Render instances before checking the public UI.
  await getResponse(target, "/health/live", fetchImpl, retryHealthMs);
  await getResponse(target, "/health/ready", fetchImpl, 90_000);

  const party = await getResponse(target, "/party/", fetchImpl);
  if (!(party.headers.get("content-type") ?? "").includes("text/html")) {
    throw new Error("/party/ must serve HTML, not an error page or API response");
  }
  const html = await party.text();
  for (const marker of [/id=["']create["']/, /id=["']join["']/, /no account (needed|required)/i]) {
    if (!marker.test(html)) {
      throw new Error("Guest multiplayer entry is missing a required host/join/no-login control: " + marker);
    }
  }

  // A valid HTML fallback returning HTTP 200 is not a playable JavaScript app.
  for (const asset of ["/party/app.js", "/party/style.css"]) {
    const response = await getResponse(target, asset, fetchImpl);
    const body = await response.text();
    if (body.length < 100 || /^\s*<!doctype html/i.test(body) || /^\s*<html/i.test(body)) {
      throw new Error("Missing or invalid public guest asset: " + asset);
    }
  }

  const credits = await getResponse(target, "/party/open-source/credits.json", fetchImpl);
  const provenance = await credits.json();
  const deployedSha = provenance?.commit;
  if (typeof deployedSha !== "string" || !/^[0-9a-f]{40}$/.test(deployedSha)) {
    throw new Error("Live guest build does not expose a verifiable 40-character source commit");
  }
  if (expectedSha && deployedSha !== expectedSha) {
    throw new Error("Public deployment is stale: live " + deployedSha + " but expected " + expectedSha +
      ". Render auto-deploy is off; deploy the reviewed main commit from the existing Render service, then rerun this check.");
  }

  return {
    target: target.origin + "/party/",
    deployedSha,
    expectedSha: expectedSha || null,
    checks: ["Public HTTP health", "Database readiness", "Guest host and join UI", "Guest JS and CSS assets", "Published source commit"],
    limitations: "Read-only verification; does not prove real two-device WebSocket gameplay or Handshake acceptance.",
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const result = await checkContestDemo({
      url: process.env.SMOKE_URL || DEFAULT_URL,
      expectedSha: process.env.EXPECTED_DEPLOYED_SHA || "",
    });
    console.log("Contest public demo checks passed:\n" + JSON.stringify(result, null, 2));
    if (process.env.GITHUB_STEP_SUMMARY) {
      await appendFile(process.env.GITHUB_STEP_SUMMARY,
        "## Contest public demo check\n\n" +
        "- Guest entry: " + result.target + "\n" +
        "- Deployed source: \x60" + result.deployedSha + "\x60\n" +
        "- Expected source: \x60" + (result.expectedSha || "not enforced") + "\x60\n" +
        "- Verified: " + result.checks.join(", ") + "\n" +
        "- Limit: " + result.limitations + "\n");
    }
  } catch (error) {
    console.error("CONTEST DEMO CHECK FAILED:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
