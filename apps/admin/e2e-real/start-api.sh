#!/bin/sh
# Starts the REAL API for the admin e2e-real suite against a SCRATCH Postgres database.
# Required env: E2E_REAL_DATABASE_URL (database name must contain "e2e" or "scratch"), E2E_BOOTSTRAP_PASSWORD (throwaway).
# The database schema is wiped, migrated and seeded at every start. Never point this at a real database.
set -e
URL="$E2E_REAL_DATABASE_URL"
PORT="${E2E_API_PORT:-4410}"
[ -n "$URL" ] || { echo "E2E_REAL_DATABASE_URL is required"; exit 1; }
[ -n "$E2E_BOOTSTRAP_PASSWORD" ] || { echo "E2E_BOOTSTRAP_PASSWORD is required"; exit 1; }
NAME=$(echo "$URL" | sed -E 's#^.*/([^/?]+)(\?.*)?$#\1#')
case "$NAME" in
  *e2e*|*scratch*) ;;
  *) echo "Refusing to wipe database '$NAME': its name must contain 'e2e' or 'scratch'"; exit 1 ;;
esac
API_DIR="$(cd "$(dirname "$0")/../../api" && pwd)"
cd "$API_DIR"
psql "${URL%%\?*}" -v ON_ERROR_STOP=1 -q -c 'DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;'
export DATABASE_URL="$URL"
pnpm exec prisma migrate deploy > /dev/null
ALLOW_DEMO_SEED=true pnpm run prisma:seed > /dev/null
export PORT
export COOKIE_SECRET="$(head -c 24 /dev/urandom | base64 | tr -d '/+=')e2esecret"
export CORS_ORIGINS="http://localhost:${E2E_ADMIN_PORT:-3011}"
export ADMIN_BOOTSTRAP_EMAIL="owner@impactpro.test"
export ADMIN_BOOTSTRAP_PASSWORD="$E2E_BOOTSTRAP_PASSWORD"
export LOGIN_THROTTLE_LIMIT=500 ORDER_THROTTLE_LIMIT=500 THROTTLE_LIMIT=5000 PUBLIC_DOC_THROTTLE_LIMIT=500
exec node dist/main.js
