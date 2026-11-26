# Development Roadmap

Each phase ends with these checks: all tests green, `prisma migrate deploy` works on a clean DB, API smoke tests pass, docs are updated, and the "Status" section in `CLAUDE.md` is updated.

| # | Phase | Deliverables | Acceptance criteria | Tests |
|---|---|---|---|---|
| 1 | Architecture & infrastructure | Monorepo (pnpm + Turbo); docs (this folder); `infra/docker-compose.yml` (postgres, meilisearch, minio, mailpit); NestJS API skeleton with config validation, Prisma, Swagger, `/api/v1/health`, global envelope/filter; storefront homepage shell in Impact Pro brand; GitHub Actions CI | `pnpm install && pnpm build` passes; `docker compose up` brings services healthy; `GET /api/v1/health` reports the database; storefront renders at :3000 | Health e2e (supertest), config validation unit, storefront smoke (Playwright) |
| 2 | Auth & organizations | Register/login/logout/refresh; Argon2id; HTTP-only cookies; CSRF; rate limiting; RBAC guards; organizations, memberships, invitations; tenant Prisma extension; audit module | Users can sign up/in; roles enforced; org A cannot read org B | Auth unit/integration; **authorization matrix tests**; **cross-tenant isolation tests**; CSRF/rate-limit tests |
| 3 | Catalog & storefront | Products, variants, attributes, categories, decoration options, price tiers; Meilisearch indexing; storefront home, category, search, filters, comparison, PDP; SEO (metadata, sitemap, JSON-LD) | Catalog managed via API; search returns faceted results < 200 ms; Lighthouse SEO ≥ 95 | Pricing resolution unit; catalog API; search indexing job; Playwright browse/search |
| 4 | Cart, checkout, payments, orders | Anonymous + user carts; checkout with reservation; price snapshot; payment intents (card provider, MonCash, NatCash, invoice); webhooks; order state machine; quotes; contact & consultation booking | No oversell under concurrency; historical prices unchanged after catalog edit; webhook idempotent | **Inventory concurrency test**; **checkout tests**; **order lifecycle tests**; webhook signature/idempotency |
| 5 | Admin dashboard | `apps/admin`: login, dashboard KPIs, users/roles, orgs, products/categories/pricing, orders, payments, audit logs, settings; shadcn/ui data tables | Every visible admin action calls a real endpoint | Playwright admin CRUD flows; component tests |
| 6 | Suppliers & procurement | Suppliers, contacts, supplier products; PO lifecycle with approval; goods receipts → ledger | Received qty updates stock via ledger; PO cannot over-receive | PO lifecycle integration; receipt → ledger tests |
| 7 | Inventory & warehousing | Warehouses, locations, balances, movements, adjustments, transfers, counts/reconciliation, low-stock alerts, damaged/in-transit | Balances equal ledger recomputation; low-stock alerts fire | Ledger immutability; transfer in-transit; reconciliation; alert job |
| 8 | Production & QC | Production jobs, milestones, media (S3), inspections, sample + production approval workflows | Job cannot enter production before sample approval; customer sees only visible media | Workflow state-machine tests; upload security tests |
| 9 | Kitting & fulfillment | Kits, assembly, fulfillment orders, pick lists, packing, packages, labels, shipments, partial shipments, tracking, delivery confirmation | Picked ≤ ordered, shipped ≤ packed; kit assembly consumes components atomically | **Fulfillment tests**; partial shipment; kit assembly concurrency |
| 10 | Customer portal | `apps/portal`: org dashboard, programs, orders & tracking, catalog, inventory visibility, production progress/photos, QC reports, documents, members | Customer admins manage members; all data org-scoped | Portal Playwright flows; isolation E2E |
| 11 | Multi-location distribution | Program locations (CSV import), allocation matrix engine, per-destination fulfillment orders, budget checks, per-location tracking | Σ allocations ≤ program qty enforced under concurrency | Allocation engine unit + concurrency; multi-destination E2E |
| 12 | Reporting, testing, deployment | Analytics views, report exports (CSV/PDF), notifications polish; full E2E suite; production Dockerfiles, migrations pipeline, backups (PITR + nightly dump), monitoring/logging, optional Postgres RLS | Staging → prod deploy via CI; restore drill succeeds; p95 API < 300 ms | Full E2E; load test on checkout; backup restore test |

## Phase 1 checklist

- [x] Monorepo root (pnpm workspaces, Turbo, brand package)
- [x] Architecture, ERD, API, roadmap, security, brand docs
- [ ] `infra/docker-compose.yml` + `.env.example`
- [ ] `apps/api` skeleton (config, Prisma schema v1, health, Swagger, envelope, error filter, tests)
- [ ] `apps/storefront` branded homepage shell
- [ ] CI workflow
