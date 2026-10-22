import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir:"./e2e",timeout:60_000,fullyParallel:false,retries:1,
  use:{baseURL:process.env.BASE_URL??"http://127.0.0.1:5000",trace:"retain-on-failure",screenshot:"only-on-failure"},
  projects:[{name:"chromium",use:{...devices["Desktop Chrome"]}},{name:"firefox",use:{...devices["Desktop Firefox"]}},{name:"webkit",use:{...devices["Desktop Safari"]}}],
});
