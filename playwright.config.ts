import { defineConfig, devices } from "@playwright/test";

const webPort = process.env.E2E_WEB_PORT ?? "3100";
const apiPort = process.env.E2E_API_PORT ?? "3101";
const uploadPort = process.env.E2E_UPLOAD_PORT ?? "3102";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: `http://127.0.0.1:${webPort}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: `E2E_WEB_PORT=${webPort} E2E_API_PORT=${apiPort} E2E_UPLOAD_PORT=${uploadPort} pnpm exec tsx e2e/support/server.ts`,
      url: `http://127.0.0.1:${apiPort}/api/v1/health`,
      timeout: 120_000,
      reuseExistingServer: false,
    },
    {
      command:
        `VITE_API_PROXY_TARGET=http://127.0.0.1:${apiPort} ` +
        `VITE_UPLOAD_PROXY_TARGET=http://127.0.0.1:${uploadPort} ` +
        `pnpm --filter @procurement/web exec vite dev --host 127.0.0.1 --port ${webPort}`,
      url: `http://127.0.0.1:${webPort}/`,
      timeout: 120_000,
      reuseExistingServer: false,
    },
  ],
});
