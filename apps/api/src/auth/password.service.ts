import { Inject, Injectable } from '@nestjs/common';
import { Algorithm, hash, verify } from '@node-rs/argon2';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';
import { COMMON_PASSWORDS } from './common-passwords';

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 128;

export type PasswordProblem = 'TOO_SHORT' | 'TOO_LONG' | 'TOO_COMMON' | 'REPEATED_CHARACTER' | 'CONTAINS_EMAIL' | 'ONLY_DIGITS';

/** French messages shown by the storefront; the codes stay stable for clients. */
export const PASSWORD_MESSAGES: Record<PasswordProblem, string> = {
  TOO_SHORT: `Le mot de passe doit contenir au moins ${PASSWORD_MIN} caractères.`,
  TOO_LONG: `Le mot de passe ne peut pas dépasser ${PASSWORD_MAX} caractères.`,
  TOO_COMMON: 'Ce mot de passe est trop courant. Choisissez-en un autre.',
  REPEATED_CHARACTER: 'Le mot de passe ne peut pas être un seul caractère répété.',
  CONTAINS_EMAIL: 'Le mot de passe ne doit pas contenir votre adresse e-mail.',
  ONLY_DIGITS: 'Ajoutez des lettres : un mot de passe uniquement numérique est trop faible.',
};

/** Pure policy check (no I/O) so it can be unit-tested. */
export function checkPasswordPolicy(password: string, ctx: { email?: string } = {}): PasswordProblem[] {
  const problems: PasswordProblem[] = [];
  const chars = [...password];
  if (chars.length < PASSWORD_MIN) problems.push('TOO_SHORT');
  if (chars.length > PASSWORD_MAX) problems.push('TOO_LONG');
  const lowered = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lowered)) problems.push('TOO_COMMON');
  if (chars.length > 1 && new Set(chars).size === 1) problems.push('REPEATED_CHARACTER');
  if (/^[0-9]+$/.test(password) && !problems.includes('TOO_SHORT')) problems.push('ONLY_DIGITS');
  const local = ctx.email?.split('@')[0]?.toLowerCase();
  if (local && local.length >= 4 && lowered.includes(local)) problems.push('CONTAINS_EMAIL');
  return problems;
}

@Injectable()
export class PasswordService {
  private readonly opts: { algorithm: Algorithm; memoryCost: number; timeCost: number; parallelism: number };
  /** Verified against when the account does not exist, so "unknown email" costs as much as "wrong password". */
  private dummyHash?: Promise<string>;

  constructor(@Inject(ENV) env: Env) {
    this.opts = { algorithm: Algorithm.Argon2id, memoryCost: env.ARGON2_MEMORY_KIB, timeCost: env.ARGON2_TIME_COST, parallelism: 1 };
  }

  hash(password: string): Promise<string> {
    return hash(password, this.opts);
  }

  async verify(storedHash: string | null | undefined, password: string): Promise<boolean> {
    if (!storedHash) {
      this.dummyHash ??= this.hash('dummy-password-for-timing-equalisation');
      await verify(await this.dummyHash, password).catch(() => false);
      return false;
    }
    try {
      return await verify(storedHash, password);
    } catch {
      return false;
    }
  }
}
