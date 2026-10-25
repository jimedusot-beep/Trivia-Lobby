import express from "express";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { attachPartySocket } from "./transport.js";

export function createPartyServer(options = {}) {
  const app = express(), server = createServer(app);
  app.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    res.set("X-Content-Type-Options", "nosniff");
    res.set("Referrer-Policy", "no-referrer");
    res.set("Content-Security-Policy", "default-src 'self'; connect-src 'self'; script-src 'self'; style-src 'self'; frame-ancestors 'none'");
    next();
  });
  app.use(express.static(fileURLToPath(new URL("./public", import.meta.url))));
  app.get("/health", (_req, res) => res.json({ ok: true }));
  const party = attachPartySocket(server, options);
  return {
    server, ...party,
    async close() {
      await party.close();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { server } = createPartyServer();
  const port = Number(process.env.PORT || 3001);
  server.listen(port, process.env.HOST || "127.0.0.1", () =>
    console.log(`Party engine: http://localhost:${port}`),
  );
}
