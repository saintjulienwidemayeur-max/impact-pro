import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PORT ?? 3000);
const MOCK_PORT = Number(process.env.MOCK_API_PORT ?? 4100);
/**
 * By default the suite runs against e2e/mock-api.mjs (a contract-faithful test double, see the file header) so it is
 * deterministic and independent of the database. `E2E_REAL_API=1` runs it against the real API at NEXT_PUBLIC_API_URL
 * (default http://localhost:4000, which must be running and seeded) — the mock-only assertions are skipped there.
 */
const REAL = Boolean(process.env.E2E_REAL_API);
const API = REAL ? (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000") : `http://localhost:${MOCK_PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: `http://localhost:${PORT}`, trace: "off" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
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
      // NEXT_PUBLIC_API_URL is inlined at build time, so the storefront is (re)built against the chosen API.
      command: `pnpm exec next build && pnpm exec next start -p ${PORT}`,
      url: `http://localhost:${PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 300_000,
      env: { NEXT_PUBLIC_API_URL: API, API_URL: API, NEXT_PUBLIC_SHOW_PRICES: process.env.NEXT_PUBLIC_SHOW_PRICES ?? "true" },
    },
  ],
});
