# API Modules & Endpoint Map

Base URL: `/api/v1`. Swagger UI: `/api/docs`; OpenAPI JSON: `/api/docs-json`.

## 1. NestJS module tree

```
AppModule
├── core/
│   ├── ConfigModule (Zod-validated env)
│   ├── PrismaModule (tenant-scoped client extension)
│   ├── RedisModule · QueueModule (BullMQ) · StorageModule (S3) · SearchModule (Meilisearch)
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

**HTTP status codes:** 200 OK · 201 Created · 204 No Content · 400 validation · 401 unauthenticated · 403 forbidden (role) · 404 not found *(also returned for other orgs' resources)* · 409 conflict / state transition · 422 business rule · 429 rate-limited · 500.

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
