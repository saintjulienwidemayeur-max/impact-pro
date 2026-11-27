import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.ADMIN_PORT ?? 3001);
const MOCK_PORT = Number(process.env.MOCK_API_PORT ?? 4101);
/** Default: run against e2e/mock-api.mjs (contract-faithful double). `E2E_REAL_API=1`: the real API at API_URL. */
const REAL = Boolean(process.env.E2E_REAL_API);
const API = REAL ? (process.env.API_URL ?? "http://localhost:4000") : `http://localhost:${MOCK_PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: `http://localhost:${PORT}`, trace: "off" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testIgnore: /unit\.spec\.ts/ },
  ],
  webServer: [
    ...(REAL
      ? []
      : [
          {
            command: `node e2e/mock-api.mjs ${MOCK_PORT}`,
            url: `http://localhost:${MOCK_PORT}/api/v1/health`,
            reuseExistingServer: !process.env.CI,
            timeout: 30_000,
          },
        ]),
    {
      command: `pnpm exec next build && pnpm exec next start -p ${PORT}`,
      url: `http://localhost:${PORT}/login`,
      reuseExistingServer: !process.env.CI,
      timeout: 300_000,
      env: { API_URL: API, NEXT_PUBLIC_API_URL: API },
    },
  ],
});
