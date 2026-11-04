/**
 * Signal an independent missed-schedule monitor only after a real offsite
 * backup job has succeeded. The URL is a secret, not a loggable identifier.
 * Standard HTTPS GET works with hosted or self-hosted Healthchecks-style pings.
 */
export async function pingBackupHeartbeat(rawUrl, fetchImpl = globalThis.fetch) {
  if (typeof rawUrl !== "string" || !rawUrl.trim()) return { configured: false, delivered: false };
  let endpoint;
  try { endpoint = new URL(rawUrl.trim()); }
  catch { throw new Error("Backup heartbeat must be a valid HTTPS ping URL"); }
  if (rawUrl.length > 2048 || endpoint.protocol !== "https:" || endpoint.username ||
      endpoint.password || endpoint.hash || endpoint.search || endpoint.pathname === "/" ||
      !endpoint.hostname || endpoint.hostname === "localhost" || endpoint.hostname.endsWith(".localhost")) {
    throw new Error("Backup heartbeat must be an HTTPS ping URL without credentials, query, or fragment");
  }
  try {
    const response = await fetchImpl(endpoint.href, {
      method: "GET", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(8000),
    });
    if (!response?.ok) throw new Error("non-success response");
    return { configured: true, delivered: true };
  } catch {
    // Fetch exceptions may contain the secret URL. Do not log/chain them.
    throw new Error("External backup heartbeat delivery failed (URL withheld)");
  }
}
