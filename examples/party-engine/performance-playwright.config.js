import { defineConfig } from "@playwright/test";
import base from "./playwright.config.js";

// Separate performance measurements, not part of standard browser acceptance.
export default defineConfig({
  ...base, testDir: "./performance-specs", timeout: 120000, retries: 0,
  projects: base.projects.filter(project => project.name === "chromium"),
});
