import { Inject, Injectable } from '@nestjs/common';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';

interface Entry {
  failures: number;
  windowStart: number;
  lockedUntil: number;
}

const WINDOW_MS = 15 * 60 * 1000;
const MAX_LOCK_MS = 15 * 60 * 1000;
const MAX_ENTRIES = 10_000;

/**
 * Soft per-email lockout against password guessing. In memory on purpose (single API instance, Redis was removed):
 * entries are keyed by the normalised email whether or not the account exists, so a lock reveals nothing.
 * After `LOGIN_LOCKOUT_THRESHOLD` failures in 15 minutes the email is locked for 30 s, doubling per extra failure (max 15 min).
 */
@Injectable()
export class LoginAttemptsService {
  private readonly entries = new Map<string, Entry>();
  private readonly threshold: number;

  constructor(@Inject(ENV) env: Env) {
    this.threshold = env.LOGIN_LOCKOUT_THRESHOLD;
  }

  /** Seconds the caller must wait, or 0 when logins are allowed. */
  retryAfterSeconds(email: string, now = Date.now()): number {
    const e = this.entries.get(email);
    if (!e) return 0;
    if (e.lockedUntil > now) return Math.ceil((e.lockedUntil - now) / 1000);
    if (now - e.windowStart > WINDOW_MS) this.entries.delete(email);
    return 0;
  }

  recordFailure(email: string, now = Date.now()): void {
    let e = this.entries.get(email);
    if (!e || (now - e.windowStart > WINDOW_MS && e.lockedUntil <= now)) {
      e = { failures: 0, windowStart: now, lockedUntil: 0 };
      this.entries.set(email, e);
      if (this.entries.size > MAX_ENTRIES) this.evict(now);
    }
    e.failures += 1;
    if (e.failures >= this.threshold) {
      const extra = e.failures - this.threshold;
      e.lockedUntil = now + Math.min(MAX_LOCK_MS, 30_000 * 2 ** extra);
    }
  }

  recordSuccess(email: string): void {
    this.entries.delete(email);
  }

  private evict(now: number): void {
    for (const [k, v] of this.entries) if (now - v.windowStart > WINDOW_MS && v.lockedUntil <= now) this.entries.delete(k);
    // Still too large (an attack): drop the oldest entries.
    for (const k of this.entries.keys()) {
      if (this.entries.size <= MAX_ENTRIES) break;
      this.entries.delete(k);
    }
  }
}
