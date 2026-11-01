// Pure checks shared by offline fixtures and the opt-in public deployment smoke.
// No room creation, account access or network operations happen in this module.
const requiredPages = new Map([
  ["/party/", ['id="pick-games"', 'id="game-picker"', 'id="create"', 'id="join"', 'id="code"', 'id="name"', 'solo-test.html', '31 available games']],
  ["/party/solo-test.html", ['id="solo-setup"', 'id="solo-mode"', 'id="solo-seats"', 'id="solo-all-stage"', 'id="solo-all-seat-switch"']]
]);

function ensure(condition, message) {
  if (!condition) throw new Error(message);
}

// Accept a native Headers instance, or an object with a get(name) method.
export function assertPartyPage(path, response, html) {
  const markers = requiredPages.get(path);
  ensure(markers, "Unexpected public party path");
  ensure(response.status === 200, path + " must return HTTP 200");
  ensure((response.headers.get("content-type") ?? "").includes("text/html"),
    path + " must return HTML rather than fallback JSON");
  ensure((response.headers.get("cache-control") ?? "").includes("no-store"),
    path + " must not be cached across private guest/controller sessions");
  ensure(response.headers.get("x-content-type-options") === "nosniff",
    path + " must disallow MIME sniffing");
  const csp = response.headers.get("content-security-policy") ?? "";
  ensure(csp.includes("connect-src 'self'") && csp.includes("frame-ancestors 'none'"),
    path + " must retain same-origin socket and anti-framing policy");
  for (const marker of markers) {
    ensure(html.includes(marker), path + " is missing the required game control " + marker);
  }
}

export function assertPartyAsset(path, response) {
  ensure(["/party/app.js", "/party/solo-test.js"].includes(path), "Unexpected party asset");
  ensure(response.status === 200, path + " must exist in the production bundle");
  const type = response.headers.get("content-type") ?? "";
  ensure(type.includes("javascript"), path + " must be JavaScript, not a SPA HTML fallback");
  ensure((response.headers.get("cache-control") ?? "").includes("no-store"),
    path + " must not serve stale game controller code");
}

export function assertPartyMissingAsset(response) {
  ensure(response.status === 404, "Missing party asset must return HTTP 404");
  ensure(!(response.headers.get("content-type") ?? "").includes("text/html"),
    "Missing party asset must not return a successful SPA document");
}

export function assertPartyPing(message) {
  ensure(message && message.type === "pong" && Number.isFinite(message.serverNow),
    "Public guest socket did not answer a non-mutating ping");
}
