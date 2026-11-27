import { randomBytes } from "node:crypto";
import { defineConfig, devices } from "@playwright/test";

/**
 * Real-API suite: admin app + the actual NestJS API + a scratch Postgres database (wiped at every start).
 *   service postgresql start
 *   createdb admin_e2e   (any database whose name contains "e2e" or "scratch")
 *   pnpm --filter @impact-pro/api build
 *   E2E_REAL_DATABASE_URL=postgresql://user:pass@localhost:5432/admin_e2e?schema=public pnpm --filter @impact-pro/admin test:e2e:real
 * The bootstrap administrator password is a random throwaway generated per run (override with E2E_BOOTSTRAP_PASSWORD).
 */
process.env.E2E_BOOTSTRAP_PASSWORD ??= `Zq${randomBytes(9).toString("hex")}-71xW`;
const API_PORT = Number(process.env.E2E_API_PORT ?? 4410);
const ADMIN_PORT = Number(process.env.E2E_ADMIN_PORT ?? 3011);
process.env.E2E_API_PORT = String(API_PORT);
process.env.E2E_ADMIN_PORT = String(ADMIN_PORT);

export default defineConfig({
  testDir: "./e2e-real",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  retries: 0,
  use: { baseURL: `http://localhost:${ADMIN_PORT}`, trace: "off", ...devices["Desktop Chrome"] },
  webServer: [
    {
      command: "sh e2e-real/start-api.sh",
      url: `http://localhost:${API_PORT}/api/v1/health`,
      reuseExistingServer: false,
      timeout: 180_000,
    },
    {
      command: `pnpm exec next build && pnpm exec next start -p ${ADMIN_PORT}`,
      url: `http://localhost:${ADMIN_PORT}/login`,
      reuseExistingServer: false,
      timeout: 300_000,
      env: { API_URL: `http://localhost:${API_PORT}`, NEXT_PUBLIC_API_URL: `http://localhost:${API_PORT}` },
    },
  ],
});
