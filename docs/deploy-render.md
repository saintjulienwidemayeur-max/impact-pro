# Deploying Impact Pro on Render

`render.yaml` (repo root) is a Render Blueprint that creates: the API (`impact-pro-api`) and the storefront (`impact-pro-storefront`).

## Database on Supabase
Use Supabase → Connect → **Session pooler** URL (`postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres`) as `DATABASE_URL`.
Do not use the Direct connection (IPv6 only; Render is IPv4) nor the Transaction pooler (port 6543; breaks Prisma migrations). URL-encode special characters in the password.
Supabase Storage is S3-compatible and can hold customer logos (`S3_ENDPOINT=https://<ref>.supabase.co/storage/v1/s3`, plus bucket and S3 access keys from Storage settings) — not yet tested.

## Steps
1. Push the branch to GitHub (already done) and merge it into `main` (Render deploys a chosen branch; you can also pick `claude/relaxed-wright-32qgi8`).
2. Render dashboard → **New → Blueprint** → connect the GitHub repo → pick the branch → Render reads `render.yaml`.
3. Render asks for the variables marked `sync: false`. First pass, leave the URLs empty or put a guess; the real URLs only exist after creation:
   - `impact-pro-api` → `CORS_ORIGINS` = `https://<storefront>.onrender.com`
   - `impact-pro-storefront` → `NEXT_PUBLIC_API_URL` = `https://<api>.onrender.com`, `NEXT_PUBLIC_SITE_URL` = `https://<storefront>.onrender.com`, optionally `NEXT_PUBLIC_WHATSAPP_NUMBER` (e.g. `509XXXXXXXX`).
   - Accounts: the storefront proxies `/api/v1/auth|me|custom-orders` to the API (first-party cookies). Set `API_URL` (or `NEXT_PUBLIC_API_URL`) **before the storefront build**; `CORS_ORIGINS` on the API must contain the storefront origin; keep `TRUST_PROXY_HOPS=1` on Render.
4. `NEXT_PUBLIC_API_URL` is **inlined at build time**: after setting it, trigger **Manual Deploy → Clear build cache & deploy** on the storefront.
5. Check `https://<api>.onrender.com/api/v1/health` (→ `database: up`) and `/api/docs`, then open the storefront URL.
6. After the first successful deploy set `AUTO_SEED=false` on the API (the seed only loads the placeholder catalog; it upserts by slug, so keeping it on would reset catalog edits).

## Limits of the free plan (read before going live)
- Free web services sleep after ~15 min idle (first request takes ~30–60 s).
- **No persistent disk**: uploaded logos in `/tmp/uploads` are lost on every restart/redeploy. For real customers use a paid instance with a **Disk** (set `UPLOAD_DIR` to its mount path) or S3-compatible storage (Cloudflare R2, Backblaze B2, AWS S3) via `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` (the S3 path is implemented but not yet tested against a real bucket).
- Use Supabase backups (paid plans) or scheduled dumps for production data.

## Custom domain
Render → service → Settings → Custom Domains (e.g. `impactpro.ht` → storefront, `api.impactpro.ht` → API). Then update `CORS_ORIGINS`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SITE_URL` and redeploy the storefront.
