// Performance-only host: keep the authoritative heat alive long enough to
// sample every split layout without a three-lap finish ending the run.
import { fileURLToPath } from "node:url";
import { createPartyServer } from "../server.js";
const { buildGameSources } = await import("../../../script/build-game-sources.mjs");
await buildGameSources();
const { server } = createPartyServer({
  partyOptions: { raceMs: 600000, raceLaps: 99 },
});
const port = Number(process.env.PORT || 4317);
server.listen(port, process.env.HOST || "127.0.0.1", () =>
  console.log(`Performance party engine: http://localhost:${port}`),
);
