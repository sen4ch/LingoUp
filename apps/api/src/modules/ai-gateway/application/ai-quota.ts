import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';
import type { AppConfig } from '../../../config/app-config.js';
import { APP_CONFIG, VALKEY } from '../../../platform/index.js';

const TWO_DAYS_SECONDS = 2 * 24 * 60 * 60;

/** Per-user daily AI request budget, shared by all API instances through Valkey. */
@Injectable()
export class AiQuota {
  constructor(
    @Inject(VALKEY) private readonly valkey: Redis,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /** Consumes one unit; false when the daily budget is exhausted. Throws if Valkey is down (fail closed). */
  async tryConsume(userId: string, now = new Date()): Promise<boolean> {
    const limit = this.config.ai.dailyQuotaPerUser;
    if (limit === 0) return false;
    const key = `ai:quota:${userId}:${now.toISOString().slice(0, 10)}`;
    const [[incrError, used]] = (await this.valkey
      .multi()
      .incr(key)
      .expire(key, TWO_DAYS_SECONDS)
      .exec()) as [[Error | null, number], [Error | null, number]];
    if (incrError) throw incrError;
    return used <= limit;
  }
}
