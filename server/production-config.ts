import { createHash, randomBytes, randomUUID } from "node:crypto";
import { isAbsolute } from "node:path";
import { deletePrivateObject, getPrivateObject, putPrivateObject, isNeonStorageEndpoint, privateBucketName } from "./object-storage";

export function validateProductionConfig() {
  if (Number(process.versions.node.split(".")[0]) < 22) throw new Error("Use Node.js 22 or newer");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  let database: URL;
  try { database = new URL(process.env.DATABASE_URL); }
  catch { throw new Error("DATABASE_URL must be a PostgreSQL URL"); }
  if (!["postgres:", "postgresql:"].includes(database.protocol)) throw new Error("DATABASE_URL must be a PostgreSQL URL");
  const port = process.env.PORT ?? "5000";
  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) throw new Error("PORT must be between 1 and 65535");
  if (!privateBucketName() && (!process.env.PRIVATE_STORAGE_DIR || !isAbsolute(process.env.PRIVATE_STORAGE_DIR))) {
    throw new Error("Configure S3_BUCKET or an absolute PRIVATE_STORAGE_DIR on a durable private volume");
  }
  if (privateBucketName() && isNeonStorageEndpoint()) {
    if (process.env.S3_FORCE_PATH_STYLE === "false") throw new Error("Neon Object Storage requires path-style S3 transport");
    if (!process.env.AWS_REGION || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      throw new Error("Neon Object Storage credentials and region are required");
    }
    if (process.env.S3_KMS_KEY_ID) throw new Error("Neon Object Storage does not support AWS KMS configuration");
  }
  if (privateBucketName() && (process.env.S3_ENDPOINT || process.env.AWS_ENDPOINT_URL_S3)) {
    let endpoint: URL;
    try { endpoint = new URL((process.env.S3_ENDPOINT ?? process.env.AWS_ENDPOINT_URL_S3)!); }
    catch { throw new Error("S3_ENDPOINT must be an HTTPS URL"); }
    if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password) throw new Error("S3_ENDPOINT must be an HTTPS URL without credentials");
  }
}

/** Exercise the same private write/read/delete permissions as real uploads, without user data. */
export async function verifyPrivateStorage() {
  const bytes = randomBytes(32);
  const key = `${randomUUID()}/${randomUUID()}.blob`;
  await putPrivateObject(key, bytes, createHash("sha256").update(bytes).digest("hex"), AbortSignal.timeout(15_000));
  try {
    if (!bytes.equals(await getPrivateObject(key, AbortSignal.timeout(15_000)))) throw new Error("Private storage did not preserve the uploaded bytes");
  } finally {
    await deletePrivateObject(key, AbortSignal.timeout(15_000));
  }
}
