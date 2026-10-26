import express, { type Express } from "express";
import type { Server } from "node:http";
import path from "node:path";
import { attachPartySocket } from "../examples/party-engine/transport.js";
import { qrcodegen } from "../client/src/lib/vendor/qrcodegen";

/** Public original demo content; never resolves accounts or reads private study data. */
export function attachGuestParty(server: Server, app: Express) {
  const assets = process.env.NODE_ENV === "production"
    ? path.resolve(__dirname, "party")
    : path.resolve(process.cwd(), "examples/party-engine/public");
  const router = express.Router();
  router.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    res.set("X-Content-Type-Options", "nosniff");
    res.set("Referrer-Policy", "no-referrer");
    res.set("Content-Security-Policy", "default-src 'self'; connect-src 'self'; script-src 'self'; style-src 'self'; frame-ancestors 'none'");
    next();
  });
  // Encode invitations locally: no third-party QR service or tracking pixels.
  router.get("/join-qr.svg",(req,res)=>{
    const code=typeof req.query.code==="string"?req.query.code.toUpperCase():"";
    if(!/^[A-HJ-NP-Z2-9]{6}$/.test(code))return res.status(400).type("text").send("Invalid party code");
    let origin:URL;
    try {
      const supplied=String(req.query.origin ?? process.env.PUBLIC_ORIGIN ?? "");
      origin=new URL(supplied);
      // The URL must be the exact public origin serving this page, never an arbitrary QR redirect.
      const expectedHost=req.get("host");
      if(!["https:","http:"].includes(origin.protocol)||!expectedHost||origin.host!==expectedHost||origin.origin!==supplied)
        return res.status(400).type("text").send("Invalid party origin");
    } catch { return res.status(400).type("text").send("Missing party origin"); }
    const url=new URL("/party/",origin);
    url.searchParams.set("code",code);
    const qr=qrcodegen.QrCode.encodeText(url.href,qrcodegen.QrCode.Ecc.MEDIUM);
    const quiet=4,size=qr.size+quiet*2;
    let cells="";
    for(let y=0;y<qr.size;y++)for(let x=0;x<qr.size;x++)if(qr.getModule(x,y))cells+=`M${x+quiet} ${y+quiet}h1v1h-1z`;
    res.type("image/svg+xml").send(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><title>Scan to join party ${code}</title><path fill="#fff" d="M0 0h${size}v${size}H0z"/><path fill="#171a36" d="${cells}"/></svg>`);
  });
  router.use(express.static(assets));
  // Missing party assets must not reach the React app's HTML fallback.
  router.use((_req, res) => res.status(404).type("text").send("Not found"));
  app.use("/party", router);
  return attachPartySocket(server, { socketPath: "/party/socket" });
}
