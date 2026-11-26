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

  it('treats empty optional variables as unset (hosting dashboards / .env.example)', () => {
    const env = loadEnv({ ...base, S3_ENDPOINT: '', S3_BUCKET: '', CORS_ORIGINS: '' });
    expect(env.S3_ENDPOINT).toBeUndefined();
    expect(env.CORS_ORIGINS).toEqual([]);
  });

  it('defaults upload limits to 10 MB for logos and 25 MB for artwork', () => {
    const env = loadEnv(base);
    expect(env.UPLOAD_MAX_BYTES).toBe(10 * 1024 * 1024);
    expect(env.UPLOAD_ARTWORK_MAX_BYTES).toBe(25 * 1024 * 1024);
    expect(loadEnv({ ...base, UPLOAD_ARTWORK_MAX_BYTES: '1000' }).UPLOAD_ARTWORK_MAX_BYTES).toBe(1000);
  });
});
