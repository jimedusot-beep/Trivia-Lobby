import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./browser-specs",
  timeout: 60000,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: "http://127.0.0.1:4317",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], ...(process.env.CHROMIUM_EXECUTABLE_PATH ? {launchOptions:{executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,args:["--no-sandbox","--disable-dev-shm-usage","--disable-gpu"]}} : {}) } },
    ...(process.env.PARTY_CROSS_BROWSER ? [
      { name:"firefox", use:{...devices["Desktop Firefox"]} },
      { name:"webkit", use:{...devices["Desktop Safari"]} },
    ] : []),
  ],
  webServer: {
    command: "node server.js",
    url: "http://127.0.0.1:4317/health",
    reuseExistingServer: false,
    env: {
      HOST: "127.0.0.1",
      PORT: "4317",
      PUBLIC_ORIGIN: "http://127.0.0.1:4317",
    },
  },
});
