import { readdir, realpath } from "node:fs/promises";
import { isAbsolute, sep } from "node:path";

type Env = Record<string, string | undefined>;

/** Restore only into an explicit empty local directory, never inherited S3. */
export async function isolatedRestoreEnvironment(env: Env = process.env): Promise<Env> {
  const target = env.RESTORE_PRIVATE_STORAGE_DIR;
  if (!target || !isAbsolute(target)) throw new Error("RESTORE_PRIVATE_STORAGE_DIR must be an existing empty absolute directory");
  const root = await realpath(target), cwd = await realpath(process.cwd());
  if (root === cwd || root.startsWith(cwd + sep) || cwd.startsWith(root + sep)) throw new Error("Restore storage must be outside the application tree");
  if (env.PRIVATE_STORAGE_DIR) {
    const source = await realpath(env.PRIVATE_STORAGE_DIR);
    if (root === source || root.startsWith(source + sep) || source.startsWith(root + sep)) throw new Error("Restore storage must be separate from source storage");
  }
  if ((await readdir(root)).length) throw new Error("Restore storage directory must be empty");
  const isolated: Env = { ...env, PRIVATE_STORAGE_DIR: root };
  for (const key of ["S3_BUCKET", "S3_ENDPOINT", "S3_FORCE_PATH_STYLE", "S3_KMS_KEY_ID", "AWS_ENDPOINT_URL_S3", "AWS_ENDPOINT_URL", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_SESSION_TOKEN"]) {
    delete isolated[key];
  }
  return isolated;
}
