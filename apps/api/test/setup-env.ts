// Test environment. Always uses a dedicated test database so tests never touch dev data.
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://impact:impact_dev@localhost:5432/impact_pro_test?schema=public';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.REDIS_URL ??= 'redis://localhost:6379';
process.env.CORS_ORIGINS ??= 'http://localhost:3000';
process.env.COOKIE_SECRET ??= 'test-only-cookie-secret-0123456789abcdef';
process.env.THROTTLE_LIMIT ??= '1000';
