#!/bin/sh
# Starts the REAL API for the account e2e suite: build, migrate, seed the catalog, run.
# Env (DATABASE_URL, COOKIE_SECRET, CORS_ORIGINS, PORT…) comes from playwright.accounts.config.ts.
set -e
cd "$(dirname "$0")/../../api"
pnpm exec nest build
pnpm exec prisma migrate deploy
pnpm exec prisma db seed
exec node dist/main.js
