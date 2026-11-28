# CLAUDE.md — Impact Pro LLC · Enterprise Promotional Commerce & Supply Chain Platform

> Source of truth for this project. Keep it current at the end of every phase.

## 0. Brand — Impact Pro ("Votre marque, partout.")

Visual identity (from *Impact Pro · Identité visuelle*, 10 pages). Apply it everywhere.

| Token | Name | HEX | Use |
|---|---|---|---|
| `teal` | Teal Impact | `#0A716A` | Primary color (≈22% of a composition) |
| `cyan` | Cyan Impact | `#42C6F0` | Secondary / highlights (≈16%) |
| `teal-deep` | Teal profond · ombre | `#0A3D39` | Shadows, dark surfaces (use instead of black) |
| `sun` | Jaune soleil · accent | `#FFC93C` | Accent: CTAs, badges, promos (small doses) |
| `ink` | Encre · texte | `#0E2A2E` | Body text, dark footer/banners |
| `white` | Blanc | `#FFFFFF` | ≈50% of a composition |
| `mist` | Fond clair | `#F2F6F5` | Page background tint |

Typography: **Fredoka** (headings, 500/600/700) and **Inter** (body, prices, contacts, 400/500/600). Google Fonts.

Logo rules: the logo is a hand drawing, **not a font** — always use the image files in `packages/brand/assets/`; never retype "Impact Pro" in a font as a logo. Keep clear space ≥ half the height of the "I". Never stretch, rotate or recolor it.

Assets:
- `logo-impact-pro.png` — primary, transparent, for light backgrounds
- `logo-impact-pro-inverse.png` — white/cyan, transparent, for teal/dark backgrounds
- `icon-ip.png` (512), `icon-ip-192.png`, `icon-ip-64.png`, `icon-ip-32.png` — "IP" app icon / favicon

Signature motifs: soft rounded cards (radius ~16–24px), offset cyan "shadow" behind teal cards, cyan + yellow bottom stripe bars, large faint teal circle arcs on teal hero/cover backgrounds, dark pill captions.

Product universe (from the brand book): tasses (mugs, sublimation), t-shirts & polos (brodés), casquettes, banderoles PVC, drapeaux plume, cartes de visite & papeterie, carnets A5, stylos (tampographie), étiquettes & sceaux, photocall / panneaux d'événement. Market: Haiti (`+509`, prices in **HTG**). Site language: **French** first (Haitian Creole as a later i18n locale).

Storefront layout reference: a modern print-shop homepage (top promo bar → header with nav/search/account/cart → dark hero with headline + CTA + promo badge → service category strip → popular products grid with price/discount/order buttons → special-offer band → "how it works" 4 steps + "why choose us" → newsletter → multi-column footer with payment methods). Reproduce the *structure*, in Impact Pro's own brand, copy and imagery — never copy another company's name, logo, text or images.

## 1. Project objective

Build a complete, independent enterprise promotional products and supply chain management platform inspired by the publicly observable functionality and UX of Vu Promo (https://vupromo.com/). Reproduce major functional capabilities only — no proprietary source code, private APIs, copyrighted assets, trademarks or confidential information.

The platform combines:
1. A premium B2B promotional products e-commerce storefront.
2. A complete administrative dashboard.
3. A customer and enterprise portal.
4. Inventory and warehouse management.
5. Procurement and supplier management.
6. Production and quality control.
7. Kitting and fulfillment.
8. Multi-location distribution and shipment tracking.
9. Reporting and analytics.

## 2. Technology stack

- Frontend: Next.js (App Router), React, TypeScript, Tailwind CSS, shadcn/ui
- Backend: NestJS, TypeScript, REST, OpenAPI/Swagger
- Data: PostgreSQL, Prisma ORM, Redis
- Jobs: Postgres queue (pg-boss, when needed — **Redis/BullMQ removed 2026-11-26**) · Search: Meilisearch · Storage: S3-compatible (MinIO in dev)
- Tests: Vitest/Jest, Playwright, API integration tests
- Infra: Docker, Docker Compose, CI/CD (GitHub Actions), env-based config
- Monorepo: pnpm workspaces + Turborepo

Modular monolith with strict module boundaries. No premature microservices.

## 3. Repository layout

```
apps/
  api/          NestJS modular monolith  (/api/v1)
  storefront/   Next.js public site       (port 3000)
  admin/        Next.js admin dashboard   (port 3001)  — Phase 5
  portal/       Next.js customer portal   (port 3002)  — Phase 10
packages/
  brand/        Logo/icon assets + design tokens
  config/       Shared tsconfig / eslint presets
docs/           Architecture, ERD, API, roadmap, security
infra/          docker-compose services, CI
```

## 4. Applications

**A. Storefront** — homepage, categories, search, filters, comparison, product details, variants, cart, checkout, payment, contact, consultation booking, solutions, services, case studies, SEO.

**B. Admin dashboard** — analytics, users, roles, organizations, products, categories, pricing, suppliers, procurement, orders, payments, warehouses, inventory, production, QC, kitting, fulfillment, shipping, reports, audit logs, settings.

**C. Customer portal** — org dashboard, programs, order history & tracking, catalog, inventory visibility, production progress & photos, QC reports, shipment tracking, multiple delivery locations, reports/downloads, member management.

## 5. Core backend modules

Authentication · Users · Roles & permissions · Organizations · Catalog · Product variants · Categories · Product attributes · Pricing · Suppliers · Procurement · Purchase orders · Warehouses · Warehouse locations · Inventory · Inventory movements · Inventory reservations · Carts · Checkout · Orders · Payments · Enterprise programs · Program locations · Product allocations · Production jobs · Production milestones · Quality inspections · Production media · Kits & kit components · Fulfillment orders · Pick lists · Packing · Packages · Shipments · CRM · Notifications · Analytics · Reporting · Audit logs.

## 6. Database rules

PostgreSQL + Prisma; normalized models with PKs, FKs, unique constraints, indexes, timestamps, status enums, transactions. Multi-org, multi-user, multi-warehouse, multi-location, multi-variant, multi-supplier, multi-program, multi-destination, multi-shipment.
- Every enterprise customer's data is isolated by `organizationId`; no cross-org access.
- Concurrency-safe inventory reservation (transactions + row locks / conditional updates).
- Order items snapshot prices at purchase time.
- Inventory movements are an immutable append-only ledger.

## 7. Inventory engine
On hand, reserved, available (= on hand − reserved − damaged hold), damaged, in-transit, transfers, adjustments, reservations, reconciliation, low-stock alerts. Never oversell under concurrency.

## 8. Enterprise program engine
Organization, manager, budget, start date, deadline, products/SKUs, multiple delivery locations with per-destination quantities & requirements, production / QC / fulfillment / shipment status. Allocation engine validates Σ allocations ≤ program quantities.

## 9. Kitting & fulfillment
Kit definitions & components, custom assembly, pick lists, picking, packing, packages, labels, tracking numbers, partial shipments, delivery confirmation. Fully auditable.

## 10. Production & QC
Production jobs (supplier, product, qty, status, ETA, milestones, media). Inspections (inspector, date, result, notes, attachments, approval). Sample approval + production approval workflows.

## 11. Security (mandatory)
Argon2id hashing · secure auth with HTTP-only cookies · CSRF protection · rate limiting · input validation · RBAC · org-level isolation · secure uploads · audit logging · secrets via env/secret manager (never hardcoded) · DB backups. Never store raw PAN/CVV — provider tokens only.

## 12. API rules
Versioned REST under `/api/v1/`. Consistent envelope `{ data, meta?, error? }`, DTO validation, pagination, filtering, sorting, correct status codes, global error handling, Swagger at `/api/docs`. Background jobs for non-blocking work.

## 13. Frontend rules
Premium, modern, responsive, accessible (WCAG AA), SEO-friendly. Reusable components; skeletons, empty/error states, toasts, confirm dialogs, form validation. **No fake buttons** — every visible action works (or links to a real page). Until a backend feature exists, link to a working page (e.g. contact/quote form) rather than a dead control.

## 14. Development rules
Before a module: inspect architecture → read docs → models → API contract → backend → frontend → validation → tests → docs. No duplicate modules/models. Seed data only for dev/test. Never silently swallow errors. Never hardcode secrets.

## 15. Testing
Unit, integration, API, authorization, inventory concurrency, order lifecycle, checkout, fulfillment, E2E. All critical workflows tested.

## 16. Phases
1 Architecture & infrastructure · 2 Auth & organizations · 3 Catalog & storefront · 4 Cart/checkout/payments/orders · 5 Admin · 6 Suppliers & procurement · 7 Inventory & warehousing · 8 Production & QC · 9 Kitting & fulfillment · 10 Customer portal · 11 Multi-location distribution · 12 Reporting, testing, production deployment.

At the end of each phase: run tests, verify migrations, verify API, fix errors, update docs, report done/remaining.

## 17. Status
- **Phase 1 — done** (2026-11-26): monorepo (pnpm + Turbo), docs/ (architecture, ERD, API map, roadmap, security, brand), API foundation (`apps/api`, port 4000: env validation, health, Swagger, envelope, throttling, Prisma schema v1 + init migration + seed, concurrency-safe inventory reserve with tests), infra/docker-compose.yml, CI workflow, storefront (`apps/storefront`, port 3000) homepage + pages in brand with Playwright smoke tests. Screenshots in docs/screenshots/.
- Not yet verified: Docker stack boot, API Docker image build, CI run on GitHub.
- Customize & order (2026-11-26): real product photos (packages/brand/photos), logo upload API (`/api/v1/uploads/logos`), public catalog API (`/api/v1/catalog/products`), custom orders + tracking (`/api/v1/custom-orders`), storefront customizer `/personnaliser/[slug]` with live logo preview, cart, `/commande`, confirmation, `/suivi`. Validation errors are 422 everywhere.
- Placeholders: HTG prices/tiers in seed, phone, email. No T-shirt photo yet (uses polo photos). S3/MinIO upload path untested; newsletter/contact endpoints still don't persist.
- **Next: Phase 2** — authentication & organizations.
- Backgrounds removed (rembg isnet) from product photos → transparent WebP in packages/brand/photos + storefront/public/photos (originals kept in packages/brand/photos/originals; banderole & photocall are scene photos, kept as JPG). New homepage section « Impression grand format & numérique » (equipements-impression.webp).
- CI fix: turbo strict env mode stripped DATABASE_URL/TEST_DATABASE_URL → `envMode: loose` in turbo.json. API env loader treats empty vars as unset.
- Render deploy: `render.yaml` + docs/deploy-render.md (API start via `apps/api/scripts/start.sh`: migrate deploy, optional AUTO_SEED). Uploads need a Disk or S3 for real use.
- Realistic logo preview (2026-11-26): product photos without the sample logo (`*-blank.webp`, made by removing ink with OpenCV) + canvas rendering in `logo-preview.tsx` (cylindrical wrap via `curve` in print-areas.json, multiply with the photo on light items, grayscale shade map on dark items). Flat items (banners, cards…) still use the patch method. Canvas is tainted by the cross-origin logo, so never read its pixels.
- Render live (workspace My Workspace): impact-pro-api, impact-pro-storefront, impact-pro-redis; DB on Supabase (Session pooler). API demo catalog needs ALLOW_DEMO_SEED=true + AUTO_SEED=true (set AUTO_SEED=false afterwards).
- Customizer v2 (2026-11-26, see docs/customizer-v2-contract.md): multi-zone designs with logo/text/artwork elements, client-side background removal, artwork uploads (≤25 MB), PER_AREA pricing with custom sizes, 14 new products (balloons, tent, roll-up, bags, umbrella, bottle, USB, keyring…); photos only for kit-derived items (docs/photos-needed.md lists the missing ones — balloons, tent, roll-up, stickers, flyers, apron show « Photo à venir »). Cart key `impactpro.cart.v3`. Storefront e2e runs on a mock API by default (`E2E_REAL_API=1` for the real one).
- Round 2 (2026-11-26): per-product option parameters (colorLabel/sizeLabel/required flags; no size for ball etc.), « Voir le rendu final » modal + PNG download, rendered mock-up thumbnails in cart/checkout/confirmation/suivi, previews uploaded with the order (`/uploads/previews`), perspective `quad` print areas, owner photos (t-shirts, cap side, tote, phone case, bottle, cups, badge, football, roll-up, tent, brochure) + football product (`balon` = ball). Owner originals in packages/brand/photos/incoming (reference-only: 03, 16, 18, 22; Freepik-watermarked: 02, 11).
- Round 3 (2026-11-26): photo quality pass — t-shirts (red/blue/black, EDSR x4 + rembg), badge, roll-up, tent rebuilt from the owner originals; low-quality kit-derived products hidden via `src/config/catalog-visibility.ts` (sac-a-cordon, gobelet-isotherme, gourde-isotherme, porte-cles, protege-passeport, cle-usb, parapluie); products without photo show the Impact Pro mark tile; roll-up size label « Taille » (85×200 preselected); t-shirt colors Rouge/Noir/Bleu royal; tote = white only. Render storefront was OOM-killed at 512 MB → `images.unoptimized` + NODE_OPTIONS=--max-old-space-size=360.
- Redis removed (2026-11-26, owner decision): no Redis in API, CI, docker-compose or Render; health checks Postgres only; rate limiting in memory; background jobs later via pg-boss on Postgres.
- Round 5 (2026-11-26): showcase images — browsing pages (cards, /personnaliser list, product page gallery) show products WITH a sample design (`public/photos/showcase/*.webp`, generated by rendering the studio with the Impact Pro logo/artwork, indexed in `src/config/showcase.json`); the studio still uses the blank photos. Gourde aluminium and phone case re-cut (EDSR / luminance mask). Products without any photo show the Impact Pro mark tile.
- Phase 2 accounts (2026-11-26): customer accounts — `/inscription`, `/connexion`, `/compte`, `/compte/commandes/[reference]`, `/mot-de-passe-oublie`; API `/auth/*` + `/me/orders` (Argon2id via @node-rs/argon2, opaque server-side sessions in HTTP-only cookie `ip_session`, CSRF double-submit `ip_csrf`, in-memory rate limits). Storefront proxies `/api/v1/auth|me|custom-orders` through Next rewrites so cookies are first-party (Safari). Gaps: no email verification/reset (no mail service), `/conditions` is a draft, no 2FA. Migration 20261126201642_customer_accounts. Account e2e: `pnpm --filter @impact-pro/storefront test:e2e:accounts` (real API).
- Admin back-office (2026-11-27, Phase 5 stage 1; contract docs/admin-contract.md): `apps/admin` (Next.js, port 3001, Render service `impact-pro-admin`) + API `/api/v1/admin/**` — staff roles (SUPER_ADMIN/ADMIN/SALES/ACCOUNTING/PRODUCTION/SUPPORT) with permission matrix, first admin from env `ADMIN_BOOTSTRAP_EMAIL`/`ADMIN_BOOTSTRAP_PASSWORD` (forced password change), orders (status flow, notes, timeline), customers directory, products & price tiers, staff users, audit log, dashboard, billing: quotes DEV-/proformas PRO-/invoices FAC- with PDF (pdfkit), payments (MonCash/NatCash/bank/Zelle/cash…), public token link + accept, reports (revenue, aging), CSV. Tests: API 286, admin mock e2e 35, admin real-API e2e `pnpm --filter @impact-pro/admin test:e2e:real` (needs E2E_REAL_DATABASE_URL on a scratch DB). Stage 2 TODO: mail module (SMTP/IMAP/Resend), inbox UI, self-hosted Stalwart kit (infra/mail, docs/mail-server.md) — billing sends through the `DOCUMENT_MAILER` port (default: 503 MAIL_NOT_CONFIGURED).
- Prices hidden & payments (2026-11-28): storefront shows no prices (`config/pricing-display.ts`, `NEXT_PUBLIC_SHOW_PRICES=true` re-enables; e2e runs with prices on, `e2e/no-prices.spec.ts` checks the hidden build with `NO_PRICES_CHECK=1 NEXT_PUBLIC_SHOW_PRICES=false`). Flow = « Envoyer ma demande de proforma » → admin sends proforma. MonCash/NatCash removed from UI and rejected by API payments (enum values kept for history); footer/checkout show Visa, Mastercard, Zelle, virement logos (`components/payment-logos.tsx`). API catalog endpoints still return prices. Phone-case photo mount + per-model cases: in progress (agent branch).
