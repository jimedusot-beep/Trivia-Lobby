import type { RequestHandler } from "express";

/** Serve release assets with per-content validators and mandatory revalidation. */
export declare function releaseAssets(directory: string): RequestHandler;
