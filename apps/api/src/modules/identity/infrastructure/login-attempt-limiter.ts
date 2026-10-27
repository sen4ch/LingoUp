import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { DomainError, VALKEY } from '../../../platform/index.js';

export const MAX_FAILED_LOGINS = 10;
export const FAILED_LOGIN_WINDOW_SECONDS = 15 * 60;

/**
 * Per-account brute-force protection that complements the per-IP rate limit: an attacker
 * rotating IP addresses still gets at most MAX_FAILED_LOGINS guesses per window and email.
 * Trade-off: anyone can temporarily lock logins for a known email; the lock expires by itself.
 * Emails are hashed so Valkey never holds them in clear text.
 */
@Injectable()
export class LoginAttemptLimiter {
  constructor(@Inject(VALKEY) private readonly valkey: Redis) {}

  async assertAllowed(email: string): Promise<void> {
    const failures = Number((await this.valkey.get(this.key(email))) ?? 0);
    if (failures >= MAX_FAILED_LOGINS) {
      throw new DomainError('RATE_LIMITED', 'Too many failed sign-in attempts. Try again later');
    }
  }

  async recordFailure(email: string): Promise<void> {
    const key = this.key(email);
    const failures = await this.valkey.incr(key);
    if (failures === 1) await this.valkey.expire(key, FAILED_LOGIN_WINDOW_SECONDS);
  }

  async reset(email: string): Promise<void> {
    await this.valkey.del(this.key(email));
  }

  private key(email: string): string {
    return `auth:login-failures:${createHash('sha256').update(email).digest('hex')}`;
  }
}
