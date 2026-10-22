import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
const scrypt = promisify(scryptCallback);
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, 64) as Buffer;
  return "scrypt$" + salt + "$" + derived.toString("hex");
}
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const [algorithm, salt, digest] = hash.split("$");
  if (algorithm !== "scrypt" || !/^[a-f0-9]{32}$/.test(salt || "") || !/^[a-f0-9]{128}$/.test(digest || "")) return false;
  const derived = await scrypt(password, salt, 64) as Buffer;
  return timingSafeEqual(derived, Buffer.from(digest, "hex"));
}
export function getCookie(header: string | undefined, name = "tl_session"): string | undefined {
  const value = header?.split(";").map(s => s.trim()).find(s => s.startsWith(name + "="));
  const token = value?.slice(name.length + 1);
  return token && /^[a-f0-9]{64}$/.test(token) ? token : undefined;
}
