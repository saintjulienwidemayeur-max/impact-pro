# Impact Pro LLC

**« Votre marque, partout. »** is the enterprise platform for promotional products and supply chain. It covers:
- a B2B storefront for custom mugs, t-shirts, caps, banners, business cards and more;
- an admin dashboard;
- an enterprise customer portal;
- the operations engine: procurement, inventory, production & QC, kitting, fulfillment and multi-location distribution.

`CLAUDE.md` is the project's source of truth.

## Repository layout

```
apps/
  api/          NestJS modular monolith — REST /api/v1, Swagger /api/docs
  storefront/   Next.js public site (port 3000)
  admin/        Next.js admin dashboard (port 3001) — Phase 5
  portal/       Next.js customer portal (port 3002) — Phase 10
packages/
  brand/        Logo & icon assets, design tokens
  config/       Shared TypeScript / lint presets
infra/          docker-compose, CI helpers
docs/           Architecture & planning docs
```

## Quickstart

Prerequisites: Node 22, pnpm 10, and Docker.

1. Install dependencies:
   ```bash
   pnpm install
   ```
2. Start Postgres, Redis, Meilisearch and MinIO:
   ```bash
   docker compose -f infra/docker-compose.yml up -d
   ```
3. Create your local env file from the example:
   ```bash
   cp apps/api/.env.example apps/api/.env
   ```
4. Run database migrations:
   ```bash
   pnpm --filter api prisma migrate dev
   ```
5. Run all apps in dev mode:
   ```bash
   pnpm dev
   ```

Once running:
- Storefront: http://localhost:3000
- API health check: http://localhost:4000/api/v1/health
- Swagger: http://localhost:4000/api/docs

Other useful scripts: `pnpm build`, `pnpm test`, `pnpm lint`, `pnpm typecheck`.

## Documentation

- [Architecture](docs/architecture.md)
- [Entity relationship plan](docs/erd.md)
- [API modules & endpoints](docs/api-modules.md)
- [Roadmap (12 phases)](docs/roadmap.md)
- [Security architecture](docs/security.md)
- [Brand guide for developers](docs/brand.md)
