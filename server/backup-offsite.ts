import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { GetObjectCommand, PutObjectCommand, S3Client, type S3ClientConfig } from "@aws-sdk/client-s3";

type Env = Record<string, string | undefined>;
export type OffsiteConfig = { bucket: string; client: S3ClientConfig };

/** Source storage uses AWS_*; the destination uses only BACKUP_* settings. */
// Destination credentials deliberately never fall back to the source credentials.
export function offsiteConfig(env: Env = process.env): OffsiteConfig | undefined {
  const bucket = env.BACKUP_S3_BUCKET;
  if (!bucket) {
    if (env.BACKUP_REQUIRE_OFFSITE === "1" || env.BACKUP_REQUIRE_OFFSITE === "true" ||
        Object.entries(env).some(([key, value]) => value && (key.startsWith("BACKUP_AWS_") || key.startsWith("BACKUP_S3_")))) {
      throw new Error("BACKUP_S3_BUCKET is required for offsite recovery");
    }
    return undefined;
  }
  for (const key of ["BACKUP_AWS_ACCESS_KEY_ID", "BACKUP_AWS_SECRET_ACCESS_KEY"] as const) {
    if (!env[key]) throw new Error(key + " is required for offsite recovery");
  }
  if (env.AWS_ACCESS_KEY_ID && env.AWS_ACCESS_KEY_ID === env.BACKUP_AWS_ACCESS_KEY_ID) {
    throw new Error("Offsite recovery requires separate source and destination credentials");
  }
  const endpoint = env.BACKUP_S3_ENDPOINT || undefined;
  if (endpoint) {
    let url: URL;
    try { url = new URL(endpoint); } catch { throw new Error("Offsite endpoint must use HTTPS"); }
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.hostname.endsWith(".aws.neon.tech")) {
      throw new Error("Offsite endpoint requires HTTPS and an independent provider");
    }
  }
  const sourceEndpoint = env.S3_ENDPOINT || env.AWS_ENDPOINT_URL_S3 || undefined;
  const sameEndpoint = (!endpoint && !sourceEndpoint) ||
    (endpoint && sourceEndpoint && new URL(endpoint).href === new URL(sourceEndpoint).href);
  if (bucket === env.S3_BUCKET && sameEndpoint) throw new Error("Offsite destination must differ from the source bucket");
  return {
    bucket,
    client: {
      region: env.BACKUP_AWS_REGION || "us-east-1",
      endpoint,
      // AWS_ENDPOINT_URL[_S3] belongs to the source (Neon in production).
      ignoreConfiguredEndpointUrls: true,
      forcePathStyle: env.BACKUP_S3_FORCE_PATH_STYLE === "true",
      requestChecksumCalculation: "WHEN_REQUIRED",
      credentials: {
        accessKeyId: env.BACKUP_AWS_ACCESS_KEY_ID!,
        secretAccessKey: env.BACKUP_AWS_SECRET_ACCESS_KEY!,
        ...(env.BACKUP_AWS_SESSION_TOKEN ? { sessionToken: env.BACKUP_AWS_SESSION_TOKEN } : {}),
      },
    },
  };
}

// The injectable transport keeps tests offline; production uses the real SDK.
type Transport = { send(command: PutObjectCommand | GetObjectCommand): Promise<any> };
export async function uploadEncryptedBackup(path: string, config: OffsiteConfig, transport?: Transport) {
  const size = (await stat(path)).size;
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  const sha256 = hash.digest("hex");
  const key = "trivia-backups/" + new Date().toISOString().replaceAll(":", "-") + "-" + randomUUID() + ".enc";
  const client = transport ? undefined : new S3Client(config.client);
  const remote = transport ?? client!;
  try {
    const stream = createReadStream(path);
    try {
      await remote.send(new PutObjectCommand({
        Bucket: config.bucket, Key: key, Body: stream, ContentLength: size,
        ContentType: "application/octet-stream", Metadata: { sha256 }, IfNoneMatch: "*",
        ...(!config.client.endpoint ? { ServerSideEncryption: "AES256" as const } : {}),
      }));
    } finally { stream.destroy(); }
    const result = await remote.send(new GetObjectCommand({ Bucket: config.bucket, Key: key }));
    if (!result.Body) throw new Error("Offsite readback verification failed: missing object");
    const verifiedHash = createHash("sha256");
    let received = 0;
    for await (const chunk of result.Body) {
      received += chunk.length;
      if (received > size) throw new Error("Offsite readback verification failed: extra bytes");
      verifiedHash.update(chunk);
    }
    if (received !== size || verifiedHash.digest("hex") !== sha256) throw new Error("Offsite readback verification failed: integrity mismatch");
    return { key, size, sha256 };
  } finally { client?.destroy(); }
}
