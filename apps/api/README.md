# @impact-pro/api

NestJS modular monolith. REST under `/api/v1`, Swagger UI at `/api/docs` (JSON at `/api/docs-json`).

## Local setup

```bash
cp apps/api/.env.example apps/api/.env      # then edit values
docker compose -f infra/docker-compose.yml --env-file infra/.env up -d   # or local postgres + redis
pnpm --filter @impact-pro/api prisma:migrate
pnpm --filter @impact-pro/api prisma:seed    # dev data only
pnpm --filter @impact-pro/api dev            # http://localhost:4000/api/v1 · docs at /api/docs
```

Production-style run: `pnpm --filter @impact-pro/api build && pnpm --filter @impact-pro/api start`
(apply migrations first with `prisma:deploy`).

## Tests

`pnpm --filter @impact-pro/api test` runs unit, e2e (supertest) and integration tests. Integration tests use a
dedicated database (`TEST_DATABASE_URL`, default `impact_pro_test`); migrations are applied automatically.

## Public storefront endpoints (no auth)

| Method | Path | Notes |
|---|---|---|
| GET | `/api/v1/catalog/products` | `?page&pageSize(≤100)&category=<slug>&q=` → `{ data: Product[], meta }` |
| GET | `/api/v1/catalog/products/:slug` | slug, name, description, category, basePrice, compareAtPrice, currency, minQty, unitLabel, colors, sizes, placements, priceTiers, images |
| POST | `/api/v1/uploads/logos` | multipart field `file`; PNG/JPEG/WEBP/PDF ≤ 10 MB, type checked from file bytes (SVG refused); 201 `{ id, url, mimeType, size, originalName }` |
| GET | `/api/v1/uploads/logos/:id` | streams the file (`nosniff`, `Cross-Origin-Resource-Policy: cross-origin`, PDF as attachment) |
| POST | `/api/v1/custom-orders` | customer + 1–20 items (`productSlug, quantity, color?, size?, placement, logoUploadId, notes?`) + `deliveryMethod`; prices computed server-side from price tiers (client prices ignored) and snapshotted; reference `IP-YYYY-NNNNNN` |
| GET | `/api/v1/custom-orders/:reference?email=` | returns the order only if the email matches; otherwise 404 |

Errors: `422 VALIDATION_ERROR` (details `[{ field, messages }]`), `404 PRODUCT_NOT_FOUND`, `422 QUANTITY_BELOW_MINIMUM`,
`422 UPLOAD_NOT_FOUND` (unknown or older than 7 days), `422 UNSUPPORTED_FILE_TYPE`, `413 PAYLOAD_TOO_LARGE`,
`404 ORDER_NOT_FOUND`, `429 TOO_MANY_REQUESTS`.
Rate limits per IP: `ORDER_THROTTLE_LIMIT` (default 10) and `UPLOAD_THROTTLE_LIMIT` (default 20) per `THROTTLE_TTL_MS`.

### Upload storage

Files are stored under a random key (`logos/<uuid>`), never the client filename. With `S3_ENDPOINT`, `S3_BUCKET`,
`S3_ACCESS_KEY` and `S3_SECRET_KEY` all set, the S3-compatible store is used (MinIO from `infra/docker-compose.yml`);
otherwise files go to `UPLOAD_DIR` (default `apps/api/var/uploads`, git-ignored).

### Catalog seed

`prisma/seed.ts` creates the 13 storefront products (slugs used by `apps/storefront`) with **placeholder HTG prices**.
It is idempotent: re-running updates products and tiers in place and archives products removed from the list.

## Conventions

- Success: `{ data, meta? }` · Error: `{ error: { code, message, details?, requestId } }`
- Every request gets an `x-request-id` (inbound value reused when safe).
- Inventory: `available = onHand − reserved − damaged`; reservations use a conditional UPDATE inside a
  transaction; DB CHECK constraints and an immutable-ledger trigger back the invariants.
