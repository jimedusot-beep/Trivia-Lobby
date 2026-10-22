import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { isAbsolute, resolve, sep, join, dirname } from "node:path";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

export type StorageBackend = "filesystem" | "s3";
export function selectedBackend(): StorageBackend {
  const backend = process.env.SOURCE_STORAGE_BACKEND ?? "filesystem";
  if (backend !== "filesystem" && backend !== "s3") throw new Error("Invalid SOURCE_STORAGE_BACKEND");
  return backend;
}
function pathFor(key: string) {
  const value = process.env.PRIVATE_STORAGE_DIR;
  if (!value || !isAbsolute(value)) throw new Error("PRIVATE_STORAGE_DIR must be an absolute persistent private directory");
  const root = resolve(value), cwd = resolve(process.cwd());
  if (root === cwd || root.startsWith(cwd + sep) || cwd.startsWith(root + sep)) throw new Error("Private sources must be outside the application tree");
  return join(root, key);
}
function checkKey(key: string) {
  if (!/^[a-f0-9-]{36}\/[a-f0-9-]{36}\.blob$/.test(key)) throw new Error("Unsafe object key");
}
function s3() {
  const bucket = process.env.SOURCE_S3_BUCKET;
  if (!bucket) throw new Error("SOURCE_S3_BUCKET is required");
  const endpoint = process.env.SOURCE_S3_ENDPOINT;
  if (endpoint && new URL(endpoint).protocol !== "https:") throw new Error("S3 endpoint must use HTTPS");
  return { bucket, client: new S3Client({ region: process.env.AWS_REGION ?? "us-east-1", endpoint, forcePathStyle: !!endpoint }) };
}
export async function putObject(backend: StorageBackend, key: string, bytes: Buffer) {
  checkKey(key);
  if (backend === "filesystem") {
    const file = pathFor(key);
    await mkdir(dirname(file), { recursive: true, mode: 0o700 });
    await writeFile(file, bytes, { flag: "wx", mode: 0o600 }); return;
  }
  const { bucket, client } = s3();
  try {
    await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: bytes,
      ContentType: "application/octet-stream", ServerSideEncryption: "AES256", IfNoneMatch: "*" }), { abortSignal: AbortSignal.timeout(30_000) });
  } finally { client.destroy(); }
}
export async function readObject(backend: string, key: string, expectedBytes: number): Promise<Buffer> {
  checkKey(key);
  if (backend === "filesystem") return readFile(pathFor(key));
  if (backend !== "s3") throw new Error("Unknown source storage backend");
  const { bucket, client } = s3();
  try {
    const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }), { abortSignal: AbortSignal.timeout(30_000) });
    if (!result.Body || result.ContentLength !== expectedBytes) throw new Error("Source size check failed");
    const chunks: Buffer[] = []; let total = 0;
    for await (const chunk of result.Body as AsyncIterable<Uint8Array>) {
      total += chunk.length;
      if (total > expectedBytes) throw new Error("Source exceeds expected size");
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  } finally { client.destroy(); }
}
export async function removeObject(backend: string, key: string) {
  checkKey(key);
  if (backend === "filesystem") { await unlink(pathFor(key)); return; }
  if (backend !== "s3") throw new Error("Unknown source storage backend");
  const { bucket, client } = s3();
  try { await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }), { abortSignal: AbortSignal.timeout(30_000) }); }
  finally { client.destroy(); }
}
