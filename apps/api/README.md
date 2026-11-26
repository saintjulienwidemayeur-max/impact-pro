# @impact-pro/api

NestJS modular monolith. REST under `/api/v1`, Swagger UI at `/api/docs` (JSON at `/api/docs-json`).

## Local setup

```bash
cp apps/api/.env.example apps/api/.env      # then edit values
docker compose -f infra/docker-compose.yml --env-file infra/.env up -d   # or local postgres + redis
pnpm --filter @impact-pro/api prisma:migrate
pnpm --filter @impact-pro/api prisma:seed    # dev data only
pnpm --filter @impact-pro/api dev
```

## Tests

`pnpm --filter @impact-pro/api test` runs unit, e2e (supertest) and integration tests. Integration tests use a
dedicated database (`TEST_DATABASE_URL`, default `impact_pro_test`); migrations are applied automatically.

## Conventions

- Success: `{ data, meta? }` · Error: `{ error: { code, message, details?, requestId } }`
- Every request gets an `x-request-id` (inbound value reused when safe).
- Inventory: `available = onHand − reserved − damaged`; reservations use a conditional UPDATE inside a
  transaction; DB CHECK constraints and an immutable-ledger trigger back the invariants.
