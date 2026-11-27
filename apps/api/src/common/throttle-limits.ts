import { envSchema } from '../config/env';

/**
 * Per-route rate limits for public write endpoints, resolved lazily from the (already validated at boot)
 * environment so tests and deployments can tune them without code changes.
 */
function read(
  key: 'ORDER_THROTTLE_LIMIT' | 'UPLOAD_THROTTLE_LIMIT' | 'PREVIEW_THROTTLE_LIMIT' | 'THROTTLE_TTL_MS' | 'REGISTER_THROTTLE_LIMIT' | 'LOGIN_THROTTLE_LIMIT' | 'PUBLIC_DOC_THROTTLE_LIMIT',
): number {
  return envSchema.shape[key].parse(process.env[key]);
}

export const orderThrottle = { default: { limit: () => read('ORDER_THROTTLE_LIMIT'), ttl: () => read('THROTTLE_TTL_MS') } };
export const uploadThrottle = { default: { limit: () => read('UPLOAD_THROTTLE_LIMIT'), ttl: () => read('THROTTLE_TTL_MS') } };
export const previewThrottle = { default: { limit: () => read('PREVIEW_THROTTLE_LIMIT'), ttl: () => read('THROTTLE_TTL_MS') } };

/** Sign-ups: 5 per hour per IP. Logins: 10 per 15 minutes per IP (the per-email lockout is handled separately). */
export const registerThrottle = { default: { limit: () => read('REGISTER_THROTTLE_LIMIT'), ttl: () => 60 * 60 * 1000 } };
export const loginThrottle = { default: { limit: () => read('LOGIN_THROTTLE_LIMIT'), ttl: () => 15 * 60 * 1000 } };

/** Public document endpoints (token-protected, unauthenticated). */
export const publicDocumentThrottle = { default: { limit: () => read('PUBLIC_DOC_THROTTLE_LIMIT'), ttl: () => read('THROTTLE_TTL_MS') } };
