import { defineConfig, devices } from "@playwright/test";

/**
 * Customer-account e2e against the REAL API + a real Postgres (sessions, cookies, CSRF and the same-origin proxy cannot
 * be meaningfully mocked). Private ports, private database. Run with:  pnpm --filter @impact-pro/storefront test:e2e:accounts
 * Needs Postgres running; E2E_DATABASE_URL defaults to the local `impact_pro_acc` database (created if missing is NOT
 * automatic: `createdb impact_pro_acc`). The default suite (`test:e2e`, mock API) does not include these tests.
 */
const WEB_PORT = Number(process.env.ACCOUNTS_WEB_PORT ?? 3350);
const API_PORT = Number(process.env.ACCOUNTS_API_PORT ?? 4350);
const API = `http://localhost:${API_PORT}`;
const DATABASE_URL = process.env.E2E_DATABASE_URL ?? "postgresql://impact:impact_dev@localhost:5432/impact_pro_acc?schema=public";

export default defineConfig({
  testDir: "./e2e-real",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  use: { baseURL: `http://localhost:${WEB_PORT}`, trace: "off" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: [
    {
      command: "sh e2e-real/start-api.sh",
      url: `${API}/api/v1/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 240_000,
      env: {
        NODE_ENV: "development",
        PORT: String(API_PORT),
        DATABASE_URL,
        COOKIE_SECRET: "e2e-accounts-cookie-secret-0123456789abcdef",
        CORS_ORIGINS: `http://localhost:${WEB_PORT}`,
        // The suite signs many accounts up: generous limits (throttling has its own API-level tests).
        REGISTER_THROTTLE_LIMIT: "1000",
        LOGIN_THROTTLE_LIMIT: "1000",
        THROTTLE_LIMIT: "5000",
        ORDER_THROTTLE_LIMIT: "1000",
        UPLOAD_THROTTLE_LIMIT: "1000",
        PREVIEW_THROTTLE_LIMIT: "1000",
        UPLOAD_DIR: "var/e2e-uploads",
      },
    },
    {
      // API_URL / NEXT_PUBLIC_API_URL are read at BUILD time (next.config rewrites + inlined client URL).
      command: `pnpm exec next build && pnpm exec next start -p ${WEB_PORT}`,
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 300_000,
      env: { NEXT_PUBLIC_API_URL: API, API_URL: API },
    },
  ],
});
