import { envSchema } from '../config/env';

/**
 * Per-route rate limits for public write endpoints, resolved lazily from the (already validated at boot)
 * environment so tests and deployments can tune them without code changes.
 */
function read(key: 'ORDER_THROTTLE_LIMIT' | 'UPLOAD_THROTTLE_LIMIT' | 'PREVIEW_THROTTLE_LIMIT' | 'THROTTLE_TTL_MS'): number {
  return envSchema.shape[key].parse(process.env[key]);
}

export const orderThrottle = { default: { limit: () => read('ORDER_THROTTLE_LIMIT'), ttl: () => read('THROTTLE_TTL_MS') } };
export const uploadThrottle = { default: { limit: () => read('UPLOAD_THROTTLE_LIMIT'), ttl: () => read('THROTTLE_TTL_MS') } };
export const previewThrottle = { default: { limit: () => read('PREVIEW_THROTTLE_LIMIT'), ttl: () => read('THROTTLE_TTL_MS') } };
