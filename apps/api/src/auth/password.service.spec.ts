import { loadEnv } from '../config/env';
import { LoginAttemptsService } from './login-attempts.service';
import { PASSWORD_MAX, PasswordService, checkPasswordPolicy } from './password.service';

const env = loadEnv({ DATABASE_URL: 'postgresql://u:p@localhost:5432/db', COOKIE_SECRET: 'x'.repeat(32) });

describe('checkPasswordPolicy', () => {
  it('accepts a long, uncommon password', () => {
    expect(checkPasswordPolicy('Cafe-Pwa-Nwa-2026!', { email: 'marie@example.com' })).toEqual([]);
  });

  it('flags every problem it finds', () => {
    expect(checkPasswordPolicy('short')).toContain('TOO_SHORT');
    expect(checkPasswordPolicy('x'.repeat(PASSWORD_MAX + 1))).toContain('TOO_LONG');
    expect(checkPasswordPolicy('PassWord123')).toContain('TOO_COMMON');
    expect(checkPasswordPolicy('zzzzzzzzzzzz')).toContain('REPEATED_CHARACTER');
    expect(checkPasswordPolicy('8675309123456')).toContain('ONLY_DIGITS');
    expect(checkPasswordPolicy('hello-jeanbaptiste-1', { email: 'JeanBaptiste@mail.com' })).toContain('CONTAINS_EMAIL');
  });

  it('ignores very short e-mail local parts', () => {
    expect(checkPasswordPolicy('abc-correct-horse-9', { email: 'abc@mail.com' })).toEqual([]);
  });

  it('counts characters, not UTF-16 units', () => {
    expect(checkPasswordPolicy('éééééééééé')).toContain('REPEATED_CHARACTER');
    expect(checkPasswordPolicy('😀'.repeat(10))).not.toContain('TOO_SHORT');
  });
});

describe('PasswordService', () => {
  const passwords = new PasswordService(env);

  it('hashes with Argon2id (≥ 19 MiB, t = 2, p = 1), salts every hash and verifies', async () => {
    const h1 = await passwords.hash('Cafe-Pwa-Nwa-2026!');
    const h2 = await passwords.hash('Cafe-Pwa-Nwa-2026!');
    expect(h1).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    expect(h1).not.toBe(h2);
    expect(await passwords.verify(h1, 'Cafe-Pwa-Nwa-2026!')).toBe(true);
    expect(await passwords.verify(h1, 'Cafe-Pwa-Nwa-2026?')).toBe(false);
  });

  it('refuses to be configured below the minimum cost', () => {
    expect(() => loadEnv({ DATABASE_URL: 'postgresql://u:p@localhost:5432/db', COOKIE_SECRET: 'x'.repeat(32), ARGON2_MEMORY_KIB: '1024' })).toThrow(/ARGON2_MEMORY_KIB/);
  });

  it('returns false (never throws) for missing or malformed hashes', async () => {
    expect(await passwords.verify(undefined, 'whatever')).toBe(false);
    expect(await passwords.verify(null, 'whatever')).toBe(false);
    expect(await passwords.verify('not-a-hash', 'whatever')).toBe(false);
  });
});

describe('LoginAttemptsService', () => {
  it('locks after the threshold with a doubling delay, expires, and resets on success', () => {
    const svc = new LoginAttemptsService(env);
    const t0 = 1_000_000;
    for (let i = 0; i < 4; i++) svc.recordFailure('a@x.com', t0 + i);
    expect(svc.retryAfterSeconds('a@x.com', t0 + 10)).toBe(0);
    svc.recordFailure('a@x.com', t0 + 10); // 5th → 30 s
    expect(svc.retryAfterSeconds('a@x.com', t0 + 11)).toBe(30);
    expect(svc.retryAfterSeconds('a@x.com', t0 + 31_000)).toBe(0);
    svc.recordFailure('a@x.com', t0 + 31_000); // 6th → 60 s
    expect(svc.retryAfterSeconds('a@x.com', t0 + 31_001)).toBe(60);
    svc.recordSuccess('a@x.com');
    expect(svc.retryAfterSeconds('a@x.com', t0 + 31_002)).toBe(0);
  });

  it('caps the lock at 15 minutes and forgets old windows', () => {
    const svc = new LoginAttemptsService(env);
    for (let i = 0; i < 30; i++) svc.recordFailure('b@x.com', 0);
    expect(svc.retryAfterSeconds('b@x.com', 1)).toBe(900);
    expect(svc.retryAfterSeconds('b@x.com', 16 * 60 * 1000)).toBe(0);
  });
});
