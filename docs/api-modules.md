# API Modules & Endpoint Map

Base URL: `/api/v1`. Swagger UI: `/api/docs`; OpenAPI JSON: `/api/docs-json`.

## 1. NestJS module tree

```
AppModule
├── core/
│   ├── ConfigModule (Zod-validated env)
│   ├── PrismaModule (tenant-scoped client extension)
│   ├── QueueModule (Postgres queue, later) · StorageModule (S3) · SearchModule (Meilisearch)
│   ├── AuditModule · HealthModule
│   └── common/ (guards, decorators, filters, interceptors, pipes, pagination)
├── identity/   AuthModule · UsersModule · RolesModule · OrganizationsModule
├── catalog/    CatalogModule · CategoriesModule · AttributesModule · VariantsModule · PricingModule
├── commerce/   CartsModule · CheckoutModule · OrdersModule · PaymentsModule · QuotesModule
├── supply/     SuppliersModule · ProcurementModule (purchase orders, goods receipts)
├── inventory/  WarehousesModule · InventoryModule (balances, movements, reservations, transfers, counts)
├── programs/   ProgramsModule (locations, items, allocations)
├── production/ ProductionModule (jobs, milestones, media) · QualityModule (inspections)
├── fulfillment/ KitsModule · FulfillmentModule (pick lists, packing, packages) · ShipmentsModule
├── engagement/ CrmModule (leads, activities, bookings, newsletter) · NotificationsModule
└── insights/   AnalyticsModule · ReportsModule
```

## 2. Conventions

**Response envelope**
```json
{ "data": { }, "meta": { "page": 1, "pageSize": 20, "total": 134, "totalPages": 7 } }
{ "error": { "code": "INSUFFICIENT_STOCK", "message": "…", "details": [ ], "requestId": "…" } }
```

**Pagination, filtering and sorting**
- `?page=1&pageSize=20`: max page size 100, default 20. Large feeds use cursors (`?cursor=…&limit=…`; `meta.nextCursor`).
- Filters use `?status=PAID&organizationId=…&createdFrom=2026-01-01&createdTo=…&q=search`.
- Sorting uses `?sort=-createdAt,name`. A leading `-` means descending. Fields come from a per-endpoint allow-list.

**HTTP status codes:** 200 OK · 201 Created · 204 No Content · 401 unauthenticated · 403 forbidden (role) · 404 not found *(also returned for other orgs' resources)* · 409 conflict / state transition · 422 validation (`details: [{ field, messages }]`) & business rule · 413 payload too large · 429 rate-limited · 500.

**Error codes:** `VALIDATION_FAILED, UNAUTHENTICATED, FORBIDDEN, NOT_FOUND, CONFLICT, INVALID_STATE_TRANSITION, INSUFFICIENT_STOCK, ALLOCATION_EXCEEDS_QUANTITY, BUDGET_EXCEEDED, PAYMENT_FAILED, IDEMPOTENCY_REPLAY, RATE_LIMITED, CSRF_INVALID, FILE_REJECTED, INTERNAL_ERROR`.

**Idempotency:** `POST /checkout`, `/payments/*` and other create endpoints accept an `Idempotency-Key` header. Keys are stored for 24 h.

**Legend:**
- Auth: `public`, `user` (any authenticated user), `customer` (CUSTOMER_ADMIN/MEMBER), or staff role names. `staff` means any staff role.
- Org-scoped: ✔ means results are filtered to the caller's organization. Staff may pass `organizationId`.

## 3. Endpoint map

### Health & auth
| Method | Path | Auth | Org |
|---|---|---|---|
| GET | /health | public | – |
| GET | /auth/csrf | public | – |
| POST | /auth/register | public | – |
| POST | /auth/login | public | – |
| POST | /auth/refresh | cookie | – |
| POST | /auth/logout | user | – |
| GET | /auth/me | user | – |
| POST | /auth/password/forgot · /auth/password/reset | public | – |
| POST | /auth/verify-email | public | – |

### Customer accounts (implemented)
Cookie `ip_session` + header `x-csrf-token` (value of cookie `ip_csrf`) on every state-changing call.
| Method | Path | Notes |
|---|---|---|
| POST | /auth/register | 201, sets cookies. `EMAIL_TAKEN`, 422 on weak password |
| POST | /auth/login | `INVALID_CREDENTIALS`, `TOO_MANY_ATTEMPTS` (429) |
| POST | /auth/logout | revokes the session |
| GET | /auth/me · /auth/csrf | `UNAUTHENTICATED` when no session |
| PATCH | /auth/me | profile (name, phone) |
| POST | /auth/change-password | `INVALID_CURRENT_PASSWORD`, `PASSWORD_UNCHANGED`; revokes other sessions |
| GET | /me/orders | paginated (`page`, `pageSize`≤50) |
| GET | /me/orders/:reference | foreign/guest → 404 `ORDER_NOT_FOUND` |
| POST | /me/orders/claim | `{reference, email}` attaches a guest order |
Other codes: `CSRF_INVALID`, `ORIGIN_NOT_ALLOWED` (403).

### Users, roles, organizations
| Method | Path | Auth | Org |
|---|---|---|---|
| GET/POST | /users | ADMIN | – |
| GET/PATCH/DELETE | /users/:id | ADMIN | – |
| GET | /roles · /permissions | ADMIN | – |
| PUT | /roles/:id/permissions | SUPER_ADMIN | – |
| GET/POST | /organizations | staff | – |
| GET/PATCH | /organizations/:id | staff, CUSTOMER_ADMIN | ✔ |
| GET | /organizations/:id/members | staff, CUSTOMER_ADMIN | ✔ |
| POST | /organizations/:id/invitations | staff, CUSTOMER_ADMIN | ✔ |
| POST | /invitations/:token/accept | public | – |
| PATCH/DELETE | /organizations/:id/members/:userId | staff, CUSTOMER_ADMIN | ✔ |
| GET/POST/PATCH/DELETE | /organizations/:id/addresses[/:addrId] | staff, customer | ✔ |

### Catalog & pricing
| Method | Path | Auth | Org |
|---|---|---|---|
| GET | /catalog/products | public | visibility |
| GET | /catalog/products/:slug | public | visibility |
| POST | /uploads/logos · /uploads/artwork · /uploads/previews (≤ 10 MB / ≤ 25 MB / ≤ 3 MB, PNG/JPEG only for previews) · GET /uploads/{logos,artwork,previews}/:id | public (rate-limited) | – |
| POST | /custom-orders (design elements: LOGO/TEXT/ARTWORK per zone; PER_PIECE / PER_AREA pricing; per-product color/size options with COLOR_REQUIRED / SIZE_REQUIRED / INVALID_OPTION; optional rendered previews per zone) · GET /custom-orders/:ref?email= | public (rate-limited) | – |
| GET | /catalog/search?q=&filters= | public | visibility |
| GET | /catalog/compare?ids= | public | – |
| GET | /catalog/categories (tree) · /catalog/categories/:slug | public | – |
| POST/PATCH/DELETE | /admin/products[/:id] | ADMIN, SALES | – |
| POST/PATCH/DELETE | /admin/products/:id/variants[/:variantId] | ADMIN | – |
| POST | /admin/products/:id/images | ADMIN | – |
| CRUD | /admin/categories · /admin/attributes | ADMIN | – |
| GET | /pricing/quote?variantId=&qty=&decoration= | public | org price list |
| CRUD | /admin/price-lists[/:id/items] | ADMIN, SALES | – |

### Commerce
| Method | Path | Auth | Org |
|---|---|---|---|
| GET | /cart | public (anon cookie) / user | ✔ |
| POST | /cart/items | public / user | ✔ |
| PATCH/DELETE | /cart/items/:id | public / user | ✔ |
| POST | /checkout | user | ✔ |
| GET | /orders | customer, staff | ✔ |
| GET | /orders/:id | customer, staff | ✔ |
| POST | /orders/:id/cancel | CUSTOMER_ADMIN, OPERATIONS | ✔ |
| PATCH | /admin/orders/:id/status | OPERATIONS, ADMIN | – |
| POST | /payments/intents | user | ✔ |
| POST | /payments/webhooks/:provider | public (signature-verified) | – |
| POST | /admin/payments/:id/refund | ADMIN | – |
| POST | /quotes · GET /quotes/:id | public / customer | ✔ |

### Suppliers & procurement
| Method | Path | Auth |
|---|---|---|
| CRUD | /suppliers[/:id] · /suppliers/:id/contacts · /suppliers/:id/products | ADMIN, OPERATIONS |
| CRUD | /purchase-orders[/:id] | OPERATIONS |
| POST | /purchase-orders/:id/submit · /approve · /send · /cancel | OPERATIONS (approve: ADMIN) |
| POST | /purchase-orders/:id/receipts | WAREHOUSE |

### Inventory & warehousing
| Method | Path | Auth | Org |
|---|---|---|---|
| CRUD | /warehouses[/:id] · /warehouses/:id/locations | ADMIN, WAREHOUSE | – |
| GET | /inventory/balances?variantId=&warehouseId=&lowStock= | staff | – |
| GET | /inventory/movements | staff | – |
| POST | /inventory/adjustments | WAREHOUSE (approval > threshold: ADMIN) | – |
| POST | /inventory/reservations · DELETE /inventory/reservations/:id | OPERATIONS (internal) | – |
| CRUD | /inventory/transfers · POST /:id/ship · /:id/receive | WAREHOUSE | – |
| CRUD | /inventory/counts · POST /:id/reconcile | WAREHOUSE | – |
| GET | /portal/inventory | customer | ✔ |

### Programs
| Method | Path | Auth | Org |
|---|---|---|---|
| GET/POST | /programs | customer, SALES, OPERATIONS | ✔ |
| GET/PATCH | /programs/:id | customer, staff | ✔ |
| POST | /programs/:id/approve | CUSTOMER_ADMIN, SALES | ✔ |
| CRUD | /programs/:id/items | CUSTOMER_ADMIN, SALES | ✔ |
| CRUD | /programs/:id/locations (+ CSV import) | customer, OPERATIONS | ✔ |
| PUT | /programs/:id/allocations (bulk matrix) | CUSTOMER_ADMIN, OPERATIONS | ✔ |
| GET | /programs/:id/progress | customer, staff | ✔ |

### Production & QC
| Method | Path | Auth | Org |
|---|---|---|---|
| CRUD | /production/jobs | PRODUCTION, OPERATIONS | – |
| POST | /production/jobs/:id/milestones · PATCH /milestones/:mid | PRODUCTION | – |
| POST | /production/jobs/:id/media | PRODUCTION | – |
| GET | /portal/production/jobs[/:id] (customer-visible media) | customer | ✔ |
| POST | /quality/inspections | QC | – |
| PATCH | /quality/inspections/:id | QC | – |
| POST | /quality/inspections/:id/approve · /reject | QC (customer for SAMPLE) | ✔ for customer |
| GET | /portal/quality/inspections[/:id] | customer | ✔ |

### Kitting, fulfillment, shipping
| Method | Path | Auth | Org |
|---|---|---|---|
| CRUD | /kits[/:id]/components | ADMIN, OPERATIONS | org-owned kits ✔ |
| POST | /kits/:id/assemblies | WAREHOUSE | – |
| GET/POST | /fulfillment/orders | OPERATIONS | – |
| POST | /fulfillment/orders/:id/pick-lists | WAREHOUSE | – |
| POST | /fulfillment/pick-lists/:id/pick (scan lines) | WAREHOUSE | – |
| POST | /fulfillment/orders/:id/packages | WAREHOUSE | – |
| POST | /shipments · POST /shipments/:id/label | WAREHOUSE | – |
| POST | /shipments/:id/events · /shipments/:id/deliver | WAREHOUSE, carrier webhook | – |
| GET | /shipments?orderId=&programId= · /shipments/:id | customer, staff | ✔ |

### CRM, notifications, analytics, reports, audit, files
| Method | Path | Auth | Org |
|---|---|---|---|
| POST | /crm/contact · /crm/consultations · /crm/newsletter | public (rate-limited, captcha) | – |
| CRUD | /crm/leads · /crm/leads/:id/activities | SALES | – |
| GET | /notifications · POST /notifications/:id/read | user | ✔ |
| GET | /analytics/dashboard | staff | – |
| GET | /portal/analytics | customer | ✔ |
| POST | /reports (async export) · GET /reports/:id | staff, customer | ✔ |
| GET | /audit-logs | ADMIN | – |
| POST | /files/presign · POST /files/:id/complete · GET /files/:id/url | user | ✔ |
| GET/PATCH | /settings | SUPER_ADMIN | – |

### Admin core (as built) — see `docs/admin-contract.md` §0–§2
All under `/api/v1/admin`, staff session + permission (`StaffGuard`), lists use `?page&pageSize&sort=field:asc|desc&q` and return `{ data, meta:{page,pageSize,total,totalPages} }`.
| Method | Path | Permission |
|---|---|---|
| GET | /admin/me | any staff (works while a password change is pending) |
| GET | /admin/dashboard | dashboard.read |
| GET | /admin/orders · /admin/orders/:id · /admin/orders/:id/events | orders.read |
| PATCH | /admin/orders/:id/status · POST /admin/orders/:id/notes | orders.write |
| GET/POST/PATCH | /admin/customers[/:id] | customers.read / customers.write |
| GET/POST/PATCH | /admin/products[/:id] | products.read / products.write |
| GET/POST/PATCH | /admin/users[/:id] · POST /admin/users/:id/reset-password | users.manage |
| GET | /admin/audit-logs | audit.read |
Order statuses move forward only (skipping ahead is allowed), `CANCELLED` from any non-delivered state, `CANCELLED → RECEIVED` for ADMIN/SUPER_ADMIN; otherwise 409 `INVALID_TRANSITION`. The `Customer` directory is filled automatically from orders and accounts (staff edits are never overwritten). Dashboard billing figures come from the `BILLING_STATS` port (`ZeroBillingStatsProvider` until billing is merged).
## 4. Billing module (`src/billing`) — quotes, proformas, invoices

Staff-only admin API (`/api/v1/admin/...`, cookie session + CSRF + `StaffGuard`) and a token-based public API. Contract: `docs/admin-contract.md` §0/§3/§5.

| Endpoint | Permission | Notes |
|---|---|---|
| `GET/POST /admin/documents` | `quotes.*` (QUOTE, PROFORMA) / `invoices.*` (INVOICE) | filters `type,status,q,customerId,orderId,from,to,overdue`; `POST` accepts `orderId` to prefill from a custom order |
| `GET/PATCH/DELETE /admin/documents/:id` | per type | draft: full edit/delete; after send: notes/dates/terms only (invoices: internal notes only) |
| `POST /admin/documents/:id/convert` `{to}` | per type | QUOTE→PROFORMA/INVOICE, PROFORMA→INVOICE; new linked draft |
| `POST …/duplicate`, `…/void {reason}`, `…/status {ACCEPTED\|REJECTED}` | per type | void is final and refused while payments are active |
| `POST …/send` | per type | PDF e-mailed through the `DOCUMENT_MAILER` port; 503 `MAIL_NOT_CONFIGURED` by default; `markAsSentOnly` records another channel |
| `POST …/payments`, `…/payments/:pid/void` | `payments.write` | row-locked; `OVERPAYMENT` guard; status PARTIALLY_PAID/PAID derived |
| `GET …/:id/pdf` | per type | pdfkit; PROFORMA label, VOID watermark, paginated lines |
| `GET /admin/documents/export.csv` | `reports.read` | UTF-8 BOM, spreadsheet-formula safe |
| `GET/PUT /admin/billing/settings` | `billing.settings` | singleton; defaults Impact Pro LLC (Miami, Florida, USA) |
| `GET /admin/reports/revenue`, `/aging` | `reports.read` | per currency |
| `GET /public/documents/:token`, `…/pdf`, `POST …/accept` | token | throttled (`PUBLIC_DOC_THROTTLE_LIMIT`), limited view, idempotent accept |

Rules: numbers `DEV|PRO|FAC-YYYY-NNNN` are gap-free (row-locked `DocumentCounter`; deleting the latest draft releases its number). Totals are always computed server-side (`computation.ts`, vectors in `apps/api/test/fixtures/billing-vectors.json` are shared with the admin UI). `isOverdue` and quote `EXPIRED` are computed, no scheduler. Every mutation writes an `AuditLog` row and a `DocumentEvent`. `BillingStatsService` (`revenueByCurrency`, `documentCounts`, `balancesByCustomer`) feeds the dashboard and customer pages.
