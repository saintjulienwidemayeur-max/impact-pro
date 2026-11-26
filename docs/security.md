# Security Architecture

## 1. Authentication

- **Password hashing:** Argon2id via `argon2`, with `memoryCost 19456 KiB, timeCost 2, parallelism 1` (OWASP baseline). Hashes are rehashed on login when the parameters change. The password policy requires at least 10 characters and checks against a breached-password list (k-anonymity HIBP check, optional).
- **Tokens:**
  - The **access token** is a JWT (EdDSA or HS512, 15 min) in the cookie `ip_at`.
  - The **refresh token** is an opaque random 256-bit value in the cookie `ip_rt` (Path `/api/v1/auth`, 30 days). Only its SHA-256 hash is stored in `Session`.
  - Both cookies are `HttpOnly; Secure; SameSite=Lax`. In production they carry a `__Host-` prefix where the path allows.
- **Refresh rotation:** every `/auth/refresh` revokes the presented token and issues a new one in the same `family`. Reusing a revoked token revokes the **entire family** (theft detection) and writes an audit log entry.
- Logout revokes the session. "Log out everywhere" revokes all sessions for the user.
- Email verification and password-reset tokens are single-use, hashed and expire after 30–60 minutes. Responses never reveal whether an email exists.
- Optional TOTP 2FA for staff roles (Phase 12).

## 2. CSRF protection

- **Double-submit token:** `GET /auth/csrf` sets a non-HttpOnly cookie `ip_csrf`, a random value signed with HMAC and bound to the session id. State-changing requests (`POST/PUT/PATCH/DELETE`) must send the header `X-CSRF-Token` matching the cookie. A guard verifies the match and the HMAC. Otherwise the request fails with `403 CSRF_INVALID`.
- Payment webhooks are exempt from CSRF and authenticate by provider signature instead.
- CORS allows only the configured app origins, with `credentials: true`.

## 3. Rate limiting

`@nestjs/throttler` uses in-memory storage (single API instance; switch to a shared store if the API is scaled out):

| Scope | Limit |
|---|---|
| Global per IP | 300 req / min |
| `/auth/login`, `/auth/password/*` | 5 / min per IP + per email; progressive lockout after 10 failures |
| `/crm/contact`, `/crm/newsletter`, `/crm/consultations` | 5 / 10 min per IP + captcha (Turnstile/hCaptcha) |
| `/checkout`, `/payments/intents` | 10 / min per user |

## 4. RBAC

Permissions are strings of the form `resource:action`, for example `orders:read` or `inventory:adjust`. Roles map to permission sets that are seeded and editable by SUPER_ADMIN. Endpoints declare them with `@Permissions()`.

| Capability | SUPER_ADMIN | ADMIN | OPERATIONS | WAREHOUSE | PRODUCTION | QC | SALES | CUSTOMER_ADMIN | CUSTOMER_MEMBER |
|---|---|---|---|---|---|---|---|---|---|
| System settings, role permissions | ✔ | – | – | – | – | – | – | – | – |
| Users & organizations (all) | ✔ | ✔ | read | – | – | – | read | – | – |
| Own org members/invitations | ✔ | ✔ | – | – | – | – | – | ✔ | read |
| Catalog & pricing | ✔ | ✔ | read | read | read | read | ✔ (price lists) | read | read |
| Orders (all) | ✔ | ✔ | ✔ | read | read | read | ✔ | – | – |
| Own org orders | – | – | – | – | – | – | – | ✔ | create/read own |
| Payments & refunds | ✔ | ✔ | read | – | – | – | read | own org read | – |
| Suppliers & purchase orders | ✔ | ✔ (approve) | ✔ | receive | read | – | – | – | – |
| Inventory adjust/transfer/count | ✔ | ✔ | read | ✔ | – | – | – | – | – |
| Own org inventory visibility | – | – | – | – | – | – | – | ✔ | ✔ |
| Programs & allocations | ✔ | ✔ | ✔ | read | read | – | ✔ | ✔ | read |
| Production jobs & media | ✔ | ✔ | ✔ | – | ✔ | read | read | own (visible) | own (visible) |
| QC inspections | ✔ | ✔ | read | – | read | ✔ | – | approve samples | read |
| Kitting, fulfillment, shipping | ✔ | ✔ | ✔ | ✔ | – | – | read | track own | track own |
| CRM leads | ✔ | ✔ | – | – | – | – | ✔ | – | – |
| Reports & analytics | ✔ | ✔ | ✔ | inventory | production | QC | sales | own org | own org |
| Audit logs | ✔ | ✔ | – | – | – | – | – | – | – |

## 5. Organization isolation

- `TenantGuard`, an `AsyncLocalStorage` context and a Prisma client extension auto-scope every tenant model by `organizationId` (see `architecture.md` §4).
- Unscoped staff access requires an explicit `prisma.unscoped()` call and is audit-logged.
- IDs are CUIDs, which are not enumerable. A foreign-org resource returns **404**.
- CI runs an automated isolation test suite on every tenant endpoint: org A user × org B resource must return 404.

## 6. Input validation and output safety

- A global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` runs with class-validator DTOs. Sort and filter fields are checked against allow-lists.
- Prisma parameterizes all queries. Raw SQL is allowed only via `$queryRaw` tagged templates, never `$queryRawUnsafe` with user input.
- `helmet` sets security headers, and the Next.js apps set a strict CSP. Rich text is sanitized with DOMPurify on output.

## 7. Secure file uploads

- Uploads go **directly to S3** through presigned POST, with policy conditions on content-type and max size (images 15 MB, documents 25 MB, artwork 100 MB).
- Allow-list: `image/jpeg, image/png, image/webp, application/pdf`, plus artwork types `image/svg+xml, application/postscript`. SVGs are sanitized.
- A post-upload `media` job checks magic bytes, strips EXIF, runs a ClamAV scan and generates thumbnails. Files stay `PENDING` and cannot be referenced until they are `READY`.
- Private files live under `private/{organizationId}/`. They are served only through short-lived presigned GET URLs after authorization. The bucket has public access blocked except the `public/` prefix behind the CDN.

## 8. Audit logging

- `AuditInterceptor` plus explicit `audit.record()` calls log every state change: actor, org, action, entity, before/after diff (secrets redacted), IP, request id.
- Logged events include logins (success and failure), role changes, price changes, inventory adjustments, approvals, refunds and unscoped access.
- The audit table is append-only: the DB role has no UPDATE/DELETE, and a trigger guards it. Retention is ≥ 2 years. Admins can export it.

## 9. Secrets management

- No secrets in the repository. Configuration comes from env vars validated by Zod at boot, and the app fails fast if anything is missing.
- `.env.example` documents the variable names with dummy values. In production, secrets come from the hosting platform's secret manager.
- Secret scanning runs in CI. Each app uses distinct DB roles: `app_rw` and a migration role.
- JWT and HMAC keys are rotated through a key id (`kid`) list.

## 10. Backups and recovery

- Managed Postgres with point-in-time recovery (7–30 days), plus a nightly encrypted `pg_dump` to separate object storage with 30-day retention.
- S3 versioning is enabled on the private buckets.
- A restore drill runs quarterly. Target RPO ≤ 15 min, RTO ≤ 4 h.

## 11. Payments

- **Raw card numbers or CVV are never stored or transmitted through our servers.** Card payments use the provider's hosted fields or checkout page (PCI SAQ-A scope), and we store only the provider references (`providerRef`, payment method token, last4/brand for display).
- Local Haitian methods:
  - **MonCash** (Digicel) and **NatCash** (Natcom) use the provider's redirect/API flow. We store the transaction id and status, and verify the payment server-side with the provider before marking it `CAPTURED`.
- Webhooks are verified by signature or by callback to the provider API, made idempotent through `providerRef` and the idempotency key, and logged.
- Bank transfer and invoice (net terms) are available for approved enterprise organizations.
- Amounts are always recomputed server-side from the order. Client-sent totals are ignored.

## 12. Operational security

- TLS everywhere with HSTS.
- Dependency auditing (`pnpm audit`, Dependabot).
- Container images are minimal (distroless/alpine), run as non-root, and are scanned in CI.
- Structured logs carry the request id; PII is redacted from them.

## 11. Customer accounts — as built (Phase 2a)

This is what ships today; sections 1–2 describe the target design (JWT/refresh, staff roles), not yet built.

- **Passwords:** Argon2id via `@node-rs/argon2` (19 MiB, t=2, p=1; `ARGON2_*` env, floors enforced). Policy: 10–128 chars, no common password, no single repeated character, not digits only, must not contain the e-mail local part. Unknown e-mails are verified against a dummy hash to equalise timing.
- **Session:** opaque 256-bit token in the HTTP-only cookie `ip_session` (Secure in production, SameSite=Lax, Path=/, 30 d sliding, 90 d absolute). Only its SHA-256 is stored (`Session.refreshTokenHash`). Login rotates (the previous cookie session is revoked); logout and password change revoke (password change signs out every other device).
- **CSRF:** signed double-submit. Readable cookie `ip_csrf` = HMAC(COOKIE_SECRET, token); header `x-csrf-token` is compared in constant time. `OriginGuard` also refuses a present `Origin` that is not in `CORS_ORIGINS`.
- **Same-origin proxy:** the storefront proxies `/api/v1/auth`, `/api/v1/me` and `/api/v1/custom-orders` (Next `rewrites()`), so the cookie is first-party (third-party cookies are blocked on `*.onrender.com` / iOS Safari). The destination is resolved at build time from `API_URL` / `NEXT_PUBLIC_API_URL`.
- **Abuse limits:** register 5/h/IP, login 10/15 min/IP, plus a per-e-mail lockout (5 failures / 15 min, then 30 s doubling to 15 min) that applies whether or not the e-mail exists. Audit actions: `auth.register|login|login_failed|login_blocked|logout|password_change|password_change_failed`.
- **Order isolation:** `CustomOrder.userId` is nullable and never auto-claimed. `/me/orders*` returns 404 for orders of other users or guests. Claiming needs reference + order e-mail.
- **Known gaps:** no e-mail verification or password reset yet (the page points to support); lockout and throttles are in memory, so they assume one API instance (move to Redis/DB when scaling); per-IP limits depend on `TRUST_PROXY_HOPS`; no 2FA.
