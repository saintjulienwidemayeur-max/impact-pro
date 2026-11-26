import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().url(),
  CORS_ORIGINS: z
    .string()
    .default('')
    .transform((v) =>
      v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  THROTTLE_TTL_MS: z.coerce.number().int().positive().default(60_000),
  THROTTLE_LIMIT: z.coerce.number().int().positive().default(120),
  COOKIE_SECRET: z.string().min(32, 'COOKIE_SECRET must be at least 32 characters'),
  /** Local upload directory, used when S3 is not configured. Relative paths resolve from the API package root. */
  UPLOAD_DIR: z.string().min(1).default('var/uploads'),
  UPLOAD_MAX_BYTES: z.coerce.number().int().positive().default(10 * 1024 * 1024),
  /** Max size of « ready-to-print » artwork files (banners, flags…). */
  UPLOAD_ARTWORK_MAX_BYTES: z.coerce.number().int().positive().default(25 * 1024 * 1024),
  /** Max size of rendered mock-up previews (PNG/JPEG) uploaded by the storefront at checkout. */
  UPLOAD_PREVIEW_MAX_BYTES: z.coerce.number().int().positive().default(3 * 1024 * 1024),
  /** S3-compatible storage (MinIO in dev). All of endpoint/bucket/keys must be set to enable it. */
  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_FORCE_PATH_STYLE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  /** Stricter limit for public order creation (requests per THROTTLE_TTL_MS per IP). */
  ORDER_THROTTLE_LIMIT: z.coerce.number().int().positive().default(10),
  UPLOAD_THROTTLE_LIMIT: z.coerce.number().int().positive().default(20),
  /** Preview uploads happen in bursts at checkout (one per print zone), so they get a more generous limit. */
  PREVIEW_THROTTLE_LIMIT: z.coerce.number().int().positive().default(60),
  /** Customer accounts. Sliding session lifetime (idle) and hard limit, in days. */
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(30),
  SESSION_ABSOLUTE_TTL_DAYS: z.coerce.number().int().positive().default(90),
  /** Account endpoints rate limits per IP: sign-ups per hour, logins per 15 minutes. */
  REGISTER_THROTTLE_LIMIT: z.coerce.number().int().positive().default(5),
  LOGIN_THROTTLE_LIMIT: z.coerce.number().int().positive().default(10),
  /** Failed logins per email (15 min window) before an increasing lockout starts. In-memory: single API instance. */
  LOGIN_LOCKOUT_THRESHOLD: z.coerce.number().int().positive().default(5),
  /** Argon2id cost. Defaults follow OWASP (>= 19 MiB, t = 2, p = 1) and cannot be lowered. */
  ARGON2_MEMORY_KIB: z.coerce.number().int().min(19456).default(19456),
  ARGON2_TIME_COST: z.coerce.number().int().min(2).default(2),
  /** Number of reverse-proxy hops to trust for req.ip (Render load balancer = 1). 0 disables. */
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(1),
});

export type Env = z.infer<typeof envSchema>;

/** Parses process.env and throws a readable error listing every invalid variable (fail fast). */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  // Hosting dashboards and .env files often leave optional variables empty (e.g. `S3_ENDPOINT=`): treat them as unset.
  const cleaned = Object.fromEntries(Object.entries(source).filter(([, v]) => v !== undefined && v !== ''));
  const parsed = envSchema.safeParse(cleaned);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}
