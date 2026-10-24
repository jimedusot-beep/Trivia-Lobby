import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { isAbsolute, join, resolve, sep } from "node:path";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

function checkKey(key: string) {
  if (!/^[a-f0-9-]{36}\/[a-f0-9-]{36}\.blob$/.test(key)) throw new Error("Unsafe object key");
}
function localRoot() {
  const value = process.env.PRIVATE_STORAGE_DIR;
  if (!value || !isAbsolute(value)) throw new Error("PRIVATE_STORAGE_DIR must name a persistent private volume");
  const root = resolve(value), cwd = resolve(process.cwd());
  if (root === cwd || root.startsWith(cwd + sep) || cwd.startsWith(root + sep)) throw new Error("Private storage must be outside the application tree");
  return root;
}
let client: S3Client | undefined;
function s3() {
  const endpoint = process.env.S3_ENDPOINT ?? process.env.AWS_ENDPOINT_URL_S3;
  if (endpoint && new URL(endpoint).protocol !== "https:") throw new Error("S3_ENDPOINT requires HTTPS");
  return client ??= new S3Client({ region: process.env.AWS_REGION ?? "us-east-1", endpoint, forcePathStyle: isNeonStorageEndpoint(endpoint) || process.env.S3_FORCE_PATH_STYLE === "true" });
}
/**
 * Neon CLI provides AWS_ENDPOINT_URL_S3 but no bucket-name environment value.
 * Use the private bucket declared by neon.ts only for a verified Neon host.
 * Older explicit S3_BUCKET installs retain their previous configuration.
 */
export function privateBucketName(): string | undefined {
  return process.env.S3_BUCKET || (isNeonStorageEndpoint() ? "uploads" : undefined);
}
const bucket = privateBucketName;

/** Neon Storage is S3-compatible but documents only standard PUT/GET/DELETE. */
export function isNeonStorageEndpoint(endpoint = process.env.S3_ENDPOINT ?? process.env.AWS_ENDPOINT_URL_S3): boolean {
  if (!endpoint) return false;
  try { return new URL(endpoint).hostname.endsWith(".aws.neon.tech"); }
  catch { return false; }
}

/** Never returns object URLs or grants a public ACL. Downloads pass through owner authorization. */
export async function putPrivateObject(key: string, bytes: Buffer, sha256: string, signal?: AbortSignal) {
  checkKey(key);
  if (bucket()) {
    const neon = isNeonStorageEndpoint();
    const params: import("@aws-sdk/client-s3").PutObjectCommandInput = {
      Bucket: bucket(), Key: key, Body: bytes,
      ContentType: "application/octet-stream", Metadata: { sha256 },
    };
    if (!neon) {
      params.ChecksumSHA256 = Buffer.from(sha256, "hex").toString("base64");
      params.ServerSideEncryption = process.env.S3_KMS_KEY_ID ? "aws:kms" : "AES256";
      if (process.env.S3_KMS_KEY_ID) params.SSEKMSKeyId = process.env.S3_KMS_KEY_ID;
      params.IfNoneMatch = "*";
    }
    await s3().send(new PutObjectCommand(params), { abortSignal: signal });
    if (neon) {
      // Use a full SHA-256 readback because optional AWS-specific headers may
      // not be implemented by Neon's S3-compatible object service.
      let verified = false;
      try {
        const result = await getPrivateObject(key, signal);
        verified = createHash("sha256").update(result).digest("hex") === sha256;
      } catch {/* Missing or unreadable uploaded objects fail validation. */}
      if (!verified) {
        await deletePrivateObject(key, signal).catch(() => {});
        throw new Error("Private object storage could not verify uploaded bytes");
      }
    }
  } else {
    await mkdir(join(localRoot(), key.split("/")[0]), { recursive: true, mode: 0o700 });
    await writeFile(join(localRoot(), key), bytes, { flag: "wx", mode: 0o600 });
  }
}
export async function getPrivateObject(key: string, signal?: AbortSignal): Promise<Buffer> {
  checkKey(key);
  if (!bucket()) return readFile(join(localRoot(), key));
  const result = await s3().send(new GetObjectCommand({ Bucket: bucket(), Key: key }), { abortSignal: signal });
  if (!result.Body || (result.ContentLength ?? 0) > 8 * 1024 * 1024) throw new Error("Invalid stored object");
  return Buffer.from(await result.Body.transformToByteArray());
}
export async function deletePrivateObject(key: string, signal?: AbortSignal) {
  checkKey(key);
  if (bucket()) await s3().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }), { abortSignal: signal });
  else await unlink(join(localRoot(), key));
}
