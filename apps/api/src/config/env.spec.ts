import { loadEnv } from './env';

describe('loadEnv', () => {
  const base = {
    DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
    REDIS_URL: 'redis://localhost:6379',
    COOKIE_SECRET: 'x'.repeat(32),
  };

  it('parses valid env and splits CORS origins', () => {
    const env = loadEnv({ ...base, CORS_ORIGINS: 'http://a.test, http://b.test' });
    expect(env.CORS_ORIGINS).toEqual(['http://a.test', 'http://b.test']);
    expect(env.PORT).toBe(4000);
  });

  it('fails fast listing every invalid variable', () => {
    expect(() => loadEnv({ COOKIE_SECRET: 'short' })).toThrow(/DATABASE_URL[\s\S]*REDIS_URL[\s\S]*COOKIE_SECRET/);
  });
});
