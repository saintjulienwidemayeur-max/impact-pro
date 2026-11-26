# Admin back-office — shared contract (API core · billing · mail · admin app)

Owner request (Haitian Creole): create an **admin page** to run the system and the business: prepare **quotes (devis)** and **proformas**, manage **billing and invoices** (send invoices), see **orders, customers**, full access; plus an **email server / mailbox inside the admin** (send + receive) — own server or an open-source one.

Stage 1 (now): admin app, RBAC, orders, customers, products, quotes/proformas/invoices + PDF + payments, reports, users, audit, settings.
Stage 2 (next): mail module (SMTP/IMAP) + inbox UI + self-hosted mail server kit (Stalwart). Billing already sends documents through a port (§5) so stage 2 only plugs in.

## 0. Conventions
- Admin API lives under `/api/v1/admin/**` (and `/api/v1/public/documents/**` for customers). Session cookie `ip_session` + CSRF header `x-csrf-token` on every mutation (existing auth, see docs/security.md "as built"). Staff = `User.isStaff = true`.
- The admin app (Next.js, own origin) proxies `/api/v1/auth/*` and `/api/v1/admin/*` to the API with Next `rewrites()` (same trick as the storefront) so cookies are first-party.
- Lists: `?page=1&pageSize=25&sort=createdAt:desc&q=…` → `{ data: T[], meta: { page, pageSize, total, totalPages } }` (pageSize ≤ 100). Errors: existing `{ error: { code, message, details? } }` (422 validation with `details:[{field,messages}]`, 401, 403 `FORBIDDEN`, 404, 409 `CONFLICT`).
- Money = strings with 2 decimals; `currency` = ISO-4217 (HTG default, USD allowed). Dates = ISO-8601 strings. Every admin mutation writes an `AuditLog` row (`action` like `document.send`, `entityType`, `entityId`, `metadata` without secrets).
- All new tables are additive migrations (never reset DBs). French UI copy; API messages may stay English.

## 1. Staff roles & permissions (RBAC)
`enum StaffRole { SUPER_ADMIN, ADMIN, SALES, ACCOUNTING, PRODUCTION, SUPPORT }` → `User.staffRole StaffRole?` (+ existing `isStaff`) and `User.mustChangePassword Boolean @default(false)`.
Permissions (strings): `dashboard.read, orders.read, orders.write, customers.read, customers.write, quotes.read, quotes.write, invoices.read, invoices.write, payments.write, billing.settings, products.read, products.write, mail.read, mail.send, users.manage, audit.read, reports.read`.
| Role | Permissions |
|---|---|
| SUPER_ADMIN | all |
| ADMIN | all except `users.manage` role changes of SUPER_ADMIN (can manage other roles) |
| SALES | dashboard.read, orders.read/write, customers.read/write, quotes.read/write, invoices.read, products.read, mail.read/send, reports.read |
| ACCOUNTING | dashboard.read, orders.read, customers.read, quotes.read, invoices.read/write, payments.write, billing.settings, reports.read, mail.read/send |
| PRODUCTION | dashboard.read, orders.read/write (status), products.read |
| SUPPORT | dashboard.read, orders.read, customers.read/write, mail.read/send |
Implementation: `@RequirePermission('orders.write')` decorator + `StaffGuard` (401 no session, 403 not staff / missing permission). Customers' accounts never reach `/admin/**`.
`GET /auth/me` for staff additionally returns `isStaff`, `staffRole`, `permissions[]`, `mustChangePassword`. `GET /admin/me` → `{ id, email, fullName, staffRole, permissions[], mustChangePassword }`.
Bootstrap: if no staff exists at API start and env `ADMIN_BOOTSTRAP_EMAIL` + `ADMIN_BOOTSTRAP_PASSWORD` (≥ 12 chars, secret, never logged) are set → create a SUPER_ADMIN (`mustChangePassword=true`). Also a CLI `pnpm --filter @impact-pro/api admin:create -- --email … ` that prompts for the password (no password on the command line).
Staff sessions: idle 8 h / absolute 24 h (env-configurable); staff login failures are audit-logged.

## 2. Admin core API (agent « core »)
**Customer directory** — new model `Customer { id, email unique(lowercase), fullName, company?, phone?, address?, city?, country? default 'HT', taxId?, notes?, userId? (link to a customer account), source ('ORDER'|'ADMIN'|'ACCOUNT'), createdAt, updatedAt }`. Upserted automatically (by email) when a custom order is created / an account registers; backfill migration from existing orders+users. `CustomOrder.customerId?` set on create.
- `GET /admin/customers?q=` → items `CustomerListItem = Customer + { ordersCount, lastOrderAt, balances:[{currency,billed,paid,due}] }` (balances from billing documents; empty until billing merges — compute via a service hook returning [] if billing tables are absent).
- `GET /admin/customers/:id` → `CustomerDetail = CustomerListItem + { orders: OrderListItem[], documents: DocumentSummary[] }`; `POST /admin/customers`; `PATCH /admin/customers/:id` (customers.write).
**Orders**
- `OrderListItem = { id, reference, status, currency, subtotal, customerName, company?, email, phone, itemCount, createdAt, customerId?, hasDocuments }`.
- `GET /admin/orders?status=&q=&from=&to=&sort=` (q matches reference, name, company, email, phone).
- `GET /admin/orders/:id` → `OrderDetail = OrderListItem + { city?, address?, deliveryMethod, notes?, customer: CustomerSummary|null, items: [...], documents: DocumentSummary[], events: OrderEvent[] }` where each item has the SAME shape as the public tracking response items (`productSlug, productName, quantity, unitPrice, lineTotal, color?, size?, widthCm?, heightCm?, areaM2?, elements[], previews[]`) plus `id`, `lineNo`, `productId`, and absolute-relative upload URLs (`/api/v1/uploads/...`) for logos/artwork/previews (admin can download originals).
- `PATCH /admin/orders/:id/status { status, note? }` (orders.write). Allowed: forward along `RECEIVED→MOCKUP_SENT→APPROVED→IN_PRODUCTION→READY→DELIVERED`, `CANCELLED` from any non-DELIVERED, `CANCELLED→RECEIVED` (reopen, ADMIN+ only). Else 409 `INVALID_TRANSITION`. `POST /admin/orders/:id/notes { message }`. New table `CustomOrderEvent { id, orderId, type ('STATUS'|'NOTE'|'DOCUMENT'|'EMAIL'), message, data Json?, actorId?, createdAt }`; `OrderEvent = { id, type, message, data?, actor:{id,name}|null, createdAt }`.
**Products** (`products.read/write`): `GET /admin/products?q=&status=` (all statuses), `GET /admin/products/:id`, `POST /admin/products`, `PATCH /admin/products/:id` — `AdminProduct = { id, slug, name, description?, status ('ACTIVE'|'DRAFT'|'ARCHIVED'), category:{id,slug,name}, basePrice, compareAtPrice?, currency, minQty, unitLabel, colors[], sizes[], colorLabel, sizeLabel, colorsRequired, sizesRequired, placements[], pricingMode, supportsLogo, supportsText, supportsArtwork, artworkRequired, customSize?, priceTiers:[{minQty,unitPrice}], updatedAt }`; PATCH accepts any subset; `priceTiers` (if present) replaces the list (validate strictly ascending minQty, ≥1 entry, price > 0). Photos are configuration files today (documented limitation).
**Dashboard** (`dashboard.read`) `GET /admin/dashboard` → `{ generatedAt, orders:{ total, byStatus:Record<status,number>, last7d, last30d }, revenue:[{ currency, paid7d, paid30d, outstanding, overdue }], customers:{ total, new30d }, documents:{ draftQuotes, openQuotes, unpaidInvoices, overdueInvoices }, mail:{ unread }|null, recentOrders: OrderListItem[5], topProducts:[{ productName, quantity, orders }] (30 d), activity: AuditEntry[10] }` (revenue/documents are zeros until billing merges).
**Staff** (`users.manage`): `StaffUser = { id, email, fullName, staffRole, status, lastLoginAt?, createdAt }`; `GET /admin/users`, `POST /admin/users { email, fullName, staffRole }` → creates the account with a server-generated temporary password returned ONCE in `temporaryPassword` (`mustChangePassword=true`), `PATCH /admin/users/:id { staffRole?, status?, fullName? }`, `POST /admin/users/:id/reset-password` → new temporary password once. Rules: cannot disable/demote yourself or the last SUPER_ADMIN; only SUPER_ADMIN can grant/revoke SUPER_ADMIN. Change-password endpoint (existing) clears `mustChangePassword`.
**Audit** (`audit.read`): `GET /admin/audit-logs?actorId=&action=&entityType=&from=&to=` → `AuditEntry = { id, action, entityType, entityId?, metadata?, actor:{id,name}|null, ipAddress?, createdAt }`.

## 3. Billing API (agent « billing »)
Models: `BillingSettings` (singleton), `Document`, `DocumentLine`, `Payment`, `DocumentEvent`, `DocumentCounter (type, year, last)`. Enums: `DocumentType {QUOTE, PROFORMA, INVOICE}`, `DocumentStatus {DRAFT, SENT, ACCEPTED, REJECTED, EXPIRED, PARTIALLY_PAID, PAID, VOID}`, `PaymentMethod {CASH, MONCASH, NATCASH, BANK_TRANSFER, ZELLE, CARD, CHECK, OTHER}`.
**Numbers**: `DEV-2026-0001` (quote), `PRO-2026-0001` (proforma), `FAC-2026-0001` (invoice); prefix configurable in settings; yearly reset; allocated at first save to non-draft? → allocated at creation, gap-free via `SELECT … FOR UPDATE` on the counter row inside the same transaction; voided numbers are never reused.
**Document** (response):
```
{ id, type, number, status, isOverdue, currency, issueDate, dueDate?, validUntil?,
  customerId?, customer:{ name, company?, email, phone?, address?, city?, country?, taxId? },
  orderId?, orderReference?, parentId?, parentNumber?, children:[{id,type,number}],
  lines:[{ id, position, description, sku?, productId?, quantity, unit?, unitPrice, discountPercent, lineTotal }],
  discountAmount, shippingAmount, taxRate, subtotal, taxTotal, total, amountPaid, balance,
  notes?, internalNotes?, terms?, paymentInstructions?,
  sentAt?, sentTo?[], acceptedAt?, publicToken?, publicUrl?, createdBy:{id,name}, createdAt, updatedAt,
  payments:[Payment], events:[{ id, type, message, actor, createdAt }] }
Payment = { id, amount, currency, method, paidAt, reference?, notes?, voidedAt?, voidReason?, recordedBy:{id,name} }
DocumentSummary = { id, type, number, status, isOverdue, currency, total, balance, issueDate, customerName }
```
**Computation (server is the source of truth; the admin UI previews with the same formula)**: `lineTotal = round2(quantity × unitPrice × (1 − discountPercent/100))` (round half away from zero); `subtotal = Σ lineTotal`; `base = subtotal − discountAmount` (≥ 0); `taxTotal = round2(base × taxRate/100)`; `total = base + shippingAmount + taxTotal`; `amountPaid = Σ non-voided payments`; `balance = total − amountPaid`. Test vectors must be shared in a fixture (`apps/api/test/fixtures/billing-vectors.json`) reused by the admin app tests.
**Rules**: DRAFT fully editable/deletable (delete only DRAFT). After SENT: quotes/proformas editable only for `notes/dueDate/validUntil/terms`; invoices immutable (void with reason, then re-issue). Payments only on INVOICE (not on DRAFT/VOID); `status` auto-moves SENT→PARTIALLY_PAID→PAID; overpayment rejected (422). `isOverdue = dueDate < today && balance > 0 && status in (SENT, PARTIALLY_PAID)` computed on read. Quotes auto-EXPIRED lazily when `validUntil < today` and status SENT.
**Endpoints** (`quotes.read/write` for QUOTE & PROFORMA, `invoices.read/write` for INVOICE, `payments.write`, `billing.settings`, `reports.read`):
- `GET /admin/documents?type=&status=&q=&customerId=&orderId=&from=&to=&overdue=true` (list item = `DocumentSummary` + `createdAt`), `GET /admin/documents/:id`, `POST /admin/documents`, `PATCH /admin/documents/:id`, `DELETE /admin/documents/:id` (draft only).
- `POST /admin/documents` body `{ type, customerId? | customer{…}, orderId?, currency?, issueDate?, dueDate?, validUntil?, lines?, taxRate?, discountAmount?, shippingAmount?, notes?, internalNotes?, terms?, paymentInstructions? }`; defaults from settings (currency, taxRate, terms, payment instructions, validity days, payment terms days); with `orderId` and no `lines`, lines are prefilled from the order items (description = product + options + zones, `unitPrice`/`quantity` from the order snapshot) and customer/currency from the order; creating a document from an order adds an `OrderEvent` (type DOCUMENT).
- `POST /admin/documents/:id/convert { to: 'PROFORMA'|'INVOICE' }` (QUOTE→PROFORMA|INVOICE, PROFORMA→INVOICE): new DRAFT copy linked via `parentId`, parent quote → ACCEPTED if it was SENT. `POST /admin/documents/:id/duplicate`. `POST /admin/documents/:id/void { reason }`. `POST /admin/documents/:id/status { status }` only for QUOTE/PROFORMA manual `ACCEPTED|REJECTED`.
- `POST /admin/documents/:id/send { to?:string[] (default customer.email), cc?, bcc?, subject?, message?, markAsSentOnly?:boolean }` — generates the PDF, sends it through the `DocumentMailer` port (§5) with the PDF attached and a link to the public PDF, moves DRAFT→SENT, sets `sentAt/sentTo`, adds events (document + order). If the mail module is not configured → 503 `MAIL_NOT_CONFIGURED` and nothing changes, unless `markAsSentOnly=true` (sent through another channel, e.g. WhatsApp) which only records the status.
- `POST /admin/documents/:id/payments { amount, method, paidAt?, reference?, notes? }`, `POST /admin/documents/:id/payments/:paymentId/void { reason }`.
- `GET /admin/documents/:id/pdf` (inline PDF `application/pdf`, filename `FAC-2026-0001.pdf`); PDF built with `pdfkit` (Helvetica; Impact Pro logo from `packages/brand/assets`; company block from settings; customer block; lines table with page breaks; totals; payment instructions; terms; footer « Document généré par Impact Pro »; PROFORMA watermark-style label « FACTURE PROFORMA — n'est pas une facture fiscale »; VOID watermark).
- Public (no auth, throttled, token = 32 random bytes base64url, only for SENT+ documents): `GET /public/documents/:token` (limited JSON: no internal notes/events), `GET /public/documents/:token/pdf`, `POST /public/documents/:token/accept` (quotes/proformas SENT→ACCEPTED, records time/IP, adds event).
- Settings: `GET/PUT /admin/billing/settings` (`billing.settings`): `{ legalName, address, city, country, phone, email, website?, taxId?, defaultCurrency, defaultTaxRate, paymentTermsDays, quoteValidityDays, prefixes:{quote,proforma,invoice}, bankDetails?, paymentInstructions?, defaultTerms?, footerNote?, logoUrl? }` (seeded with Impact Pro LLC — Miami, Florida, USA; phone/email placeholders).
- Reports (`reports.read`): `GET /admin/reports/revenue?from=&to=&groupBy=day|month` → `[{ period, currency, invoiced, paid }]`; `GET /admin/reports/aging` → `[{ currency, current, d1_30, d31_60, d61_plus, total }]`; `GET /admin/documents/export.csv?type=&from=&to=` (CSV, UTF-8 with BOM, ; separator not needed — comma).

## 4. Mail API (stage 2, agent « mail »)
Config by env only (no secrets in DB): `MAIL_PROVIDER=smtp|resend`, `MAIL_FROM_NAME`, `MAIL_FROM_ADDRESS`, `SMTP_HOST/PORT/SECURE/USER/PASS`, `IMAP_HOST/PORT/SECURE/USER/PASS`, `RESEND_API_KEY`, `MAIL_SYNC_INTERVAL_SECONDS` (default 120). Render free instances block outbound SMTP ports (25/465/587): use `resend` (HTTPS) or a paid instance. Models `MailMessage`, `MailAttachment`, `MailSyncState`. Endpoints: `GET /admin/mail/status`, `GET /admin/mail/messages?folder=INBOX|SENT|DRAFT|TRASH&q=&unread=&customerId=`, `GET /admin/mail/messages/:id`, `PATCH /admin/mail/messages/:id`, `POST /admin/mail/send`, `POST /admin/mail/messages/:id/reply`, `POST /admin/mail/sync`, `GET /admin/mail/attachments/:id`. Inbound mail is matched to a Customer by sender; HTML is sanitized. Self-hosted server: Stalwart Mail Server (open source, github.com/stalwartlabs/stalwart) kit in `infra/mail/` + `docs/mail-server.md`.

## 5. Port between billing and mail
Exact file `apps/api/src/billing/ports/document-mailer.port.ts` (identical in both branches):
```ts
export const DOCUMENT_MAILER = Symbol('DOCUMENT_MAILER');
export interface DocumentMailAttachment { filename: string; content: Buffer; contentType: string }
export interface DocumentMailInput {
  to: string[]; cc?: string[]; bcc?: string[]; subject: string; text: string; html?: string;
  attachments: DocumentMailAttachment[];
  context: { documentId: string; orderId?: string; customerId?: string; actorId: string };
}
export interface DocumentMailer {
  /** Throws `MailNotConfiguredError` (HTTP 503 MAIL_NOT_CONFIGURED) when no provider is configured. */
  send(input: DocumentMailInput): Promise<{ messageId: string }>;
}
export class MailNotConfiguredError extends Error { constructor() { super('Mail is not configured'); } }
```
Billing ships a `NotConfiguredDocumentMailer` default provider that throws `MailNotConfiguredError`; the mail module (stage 2) overrides the `DOCUMENT_MAILER` provider.

## 6. Admin app (agent « admin app », `apps/admin`, port 3001, Render service `impact-pro-admin`)
Next.js 15 App Router + TypeScript + Tailwind, French UI, Impact Pro brand (teal sidebar, Fredoka/Inter fonts copied from the storefront), `noindex`, `X-Frame-Options: DENY`, `images.unoptimized`, rewrites to `API_URL` for `/api/v1/auth/*` and `/api/v1/admin/*` (and `/api/v1/uploads/*` for viewing customer files). Staff login page (reuses `/auth/login`; non-staff → « Accès réservé à l'équipe »), forced change-password screen when `mustChangePassword`. Permission-aware navigation (hide / disable what the role cannot do; server remains the authority). Pages: Tableau de bord · Commandes (+ détail: items with logo/artwork/mock-up previews and downloads, status stepper, internal notes, timeline, « Créer un devis / une facture ») · Clients (+ détail: commandes, documents, solde) · Devis · Proformas · Factures (list tabs with filters; editor with line items, live totals using the shared formula; PDF preview (iframe of `/admin/documents/:id/pdf`), send dialog, payment dialog, convert/duplicate/void) · Paiements/Rapports (revenue chart, aging, CSV export) · Produits & prix (edit price tiers/status) · Messagerie (real page that reads `/admin/mail/status`; until stage 2 shows « Messagerie non configurée » with setup steps — never a dead control) · Utilisateurs & rôles · Journal d'audit · Paramètres (entreprise, facturation, numérotation, conditions). Skeletons, empty/error states, toasts, confirm dialogs, form validation. Tests: Playwright with a mock API (default) + a real-API suite.
