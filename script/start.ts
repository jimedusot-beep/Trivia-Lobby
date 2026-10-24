import { applyMigrations } from "./migrations";
import { validateProductionConfig, verifyPrivateStorage } from "../server/production-config";

// This entry point is built as dist/start.mjs alongside SQL and the application.
// No TypeScript loader or development dependencies are needed in production.
process.env.NODE_ENV = "production";
let stage = "configuration";
try {
  validateProductionConfig();
  stage = "private storage";
  await verifyPrivateStorage();
  console.log("Private storage verified");
  stage = "database migration";
  await applyMigrations(process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL!, new URL("./migrations/", import.meta.url));
  stage = "application";
  await import(new URL("./index.cjs", import.meta.url).href);
} catch (error) {
  // Provider errors can contain connection strings or credentials. Only config
  // errors above are controlled messages; never print raw provider exceptions.
  const code = typeof error === "object" && error !== null && "code" in error && typeof error.code === "string" && /^[A-Z0-9_]{1,20}$/.test(error.code) ? ` [${error.code}]` : "";
  // Give production operators actionable S3 failure classification without logging
  // provider error messages, signed URLs, database passwords or S3 credentials.
  const knownStorageErrors = new Set(["InvalidAccessKeyId", "SignatureDoesNotMatch",
    "AccessDenied", "NoSuchBucket", "NotImplemented", "InvalidRequest",
    "BadRequest", "CredentialsProviderError", "TimeoutError", "AbortError"]);
  const name = stage === "private storage" && error instanceof Error && knownStorageErrors.has(error.name)
    ? ` [${error.name}]` : "";
  const metadata = typeof error === "object" && error !== null && "$metadata" in error
    ? error.$metadata : undefined;
  const status = typeof metadata === "object" && metadata !== null && "httpStatusCode" in metadata
    && typeof metadata.httpStatusCode === "number" && metadata.httpStatusCode >= 400 && metadata.httpStatusCode <= 599
    ? ` [HTTP ${metadata.httpStatusCode}]` : "";
  const verifiedBytesFailed = stage === "private storage" && error instanceof Error
    && error.message === "Private object storage could not verify uploaded bytes"
    ? " [read-back verification failed]" : "";
  console.error(`Startup failed during ${stage}${code}${name}${status}${verifiedBytesFailed}${stage === "configuration" && error instanceof Error ? ": " + error.message : ""}`);
  process.exit(1);
}
