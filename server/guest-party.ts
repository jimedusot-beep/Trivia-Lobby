import express, { type Express } from "express";
import type { Server } from "node:http";
import path from "node:path";
import { attachPartySocket } from "../examples/party-engine/transport.js";
import type { RoomCheckpointStore } from "./room-checkpoints";

/** Public original demo content; never resolves accounts or reads private study data. */
export function attachGuestParty(server: Server, app: Express, checkpointStore?: RoomCheckpointStore) {
  const assets = process.env.NODE_ENV === "production"
    ? path.resolve(__dirname, "party")
    : path.resolve(process.cwd(), "examples/party-engine/public");
  const router = express.Router();
  router.use((_req, res, next) => {
    // Only the explicit one-tab local test views may be embedded by this
    // same-origin test page. External sites are still denied framing.
    const soloSeat = _req.query["solo-seat"];
    const sameOriginTestFrame = (_req.path === "/" || _req.path === "/index.html") &&
      typeof soloSeat === "string" && /^solo-[a-z0-9-]{8,80}$/.test(soloSeat);

    res.set("Cache-Control", "no-store");
    res.set("X-Content-Type-Options", "nosniff");
    res.set("Referrer-Policy", "no-referrer");
    res.set("Content-Security-Policy", `default-src 'self'; connect-src 'self'; script-src 'self'; style-src 'self'; frame-ancestors ${sameOriginTestFrame ? "'self'" : "'none'"}`);
    next();
  });
  router.use(express.static(assets));
  // Missing party assets must not reach the React app's HTML fallback.
  router.use((_req, res) => res.status(404).type("text").send("Not found"));
  app.use("/party", router);
  return attachPartySocket(server, { socketPath: "/party/socket", checkpointStore });
}
