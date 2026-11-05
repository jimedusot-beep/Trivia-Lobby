import express from "express";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

// Each server instance serves one immutable release directory.
export function releaseAssets(directory) {
  const validators = new Map();
  return express.static(directory, {
    lastModified: false,
    setHeaders(res, file) {
      if (!/\.(?:js|css|woff2?|ttf|otf|svg|png|jpe?g|webp|ico)$/i.test(file)) return;
      let tag = validators.get(file);
      if (!tag) {
        tag = '"' + createHash("sha256").update(readFileSync(file)).digest("hex") + '"';
        validators.set(file, tag);
      }
      res.setHeader("ETag", tag);
      res.setHeader("Cache-Control", "no-cache");
    },
  });
}
