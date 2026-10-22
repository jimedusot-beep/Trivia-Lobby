/**
 * Defense in depth for cookie-authenticated study mutations.
 * Host must match exactly; subdomain and non-HTTP origins are not trusted.
 */
export function trustedStudyOrigin(origin: string | undefined, host: string | undefined, fetchSite: string | undefined): boolean {
  if (fetchSite === "cross-site") return false;
  if ((origin?.length ?? 0) > 2048 || (host?.length ?? 0) > 255) return false;
  if (!origin) return true; // Non-browser clients; SameSite=Strict also protects browser cookies.
  if (!host) return false;
  try {
    const url = new URL(origin);
    return (url.protocol === "https:" || url.protocol === "http:") &&
      !url.username && !url.password && url.host === host &&
      url.pathname === "/" && !url.search && !url.hash;
  } catch {
    return false;
  }
}
