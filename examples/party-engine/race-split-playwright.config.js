import { defineConfig } from "@playwright/test";
import base from "./playwright.config.js";

// Split layout sampling visits nine live 3D pages and eight successive grids.
// Run it against the existing long-race host so the authoritative heat cannot
// end before the final layout has been measured.
export default defineConfig({
  ...base,
  testIgnore: [],
  testMatch: /race-split\.spec\.js$/,
  webServer: { ...base.webServer, command: "node performance-specs/long-race-server.js" },
});
