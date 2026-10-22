import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
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
  const endpoint = process.env.S3_ENDPOINT;
  if (endpoint && new URL(endpoint).protocol !== "https:") throw new Error("S3_ENDPOINT requires HTTPS");
  return client ??= new S3Client({ region: process.env.AWS_REGION ?? "us-east-1", endpoint, forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true" });
}
const bucket = () => process.env.S3_BUCKET;

/** Never returns object URLs or grants a public ACL. Downloads pass through owner authorization. */
export async function putPrivateObject(key: string, bytes: Buffer, sha256: string, signal?: AbortSignal) {
  checkKey(key);
  if (bucket()) {
    await s3().send(new PutObjectCommand({ Bucket: bucket(), Key: key, Body: bytes,
      ContentType: "application/octet-stream", ChecksumSHA256: Buffer.from(sha256, "hex").toString("base64"),
      ServerSideEncryption: process.env.S3_KMS_KEY_ID ? "aws:kms" : "AES256",
      ...(process.env.S3_KMS_KEY_ID ? { SSEKMSKeyId: process.env.S3_KMS_KEY_ID } : {}),
      IfNoneMatch: "*", Metadata: { sha256 },
    }), { abortSignal: signal });
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
