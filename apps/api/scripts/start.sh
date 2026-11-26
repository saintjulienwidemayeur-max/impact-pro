#!/bin/sh
# Production start: apply migrations, optionally seed the dev catalog, then run the API.
set -e
cd "$(dirname "$0")/.."
pnpm exec prisma migrate deploy
if [ "$AUTO_SEED" = "true" ]; then
  echo "AUTO_SEED=true: seeding catalog (idempotent upserts; placeholder prices)"
  pnpm exec prisma db seed
fi
exec node dist/main.js
