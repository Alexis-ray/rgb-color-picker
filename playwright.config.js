const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  timeout: 30000,
  use: {
    baseURL: "http://127.0.0.1:4173",
    headless: true,
    viewport: { width: 1440, height: 1100 },
  },
  webServer: {
    command: "npm run start",
    url: "http://127.0.0.1:4173/index.html",
    reuseExistingServer: true,
    timeout: 30000,
  },
});
