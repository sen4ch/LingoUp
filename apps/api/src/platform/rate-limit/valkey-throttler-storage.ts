import type { ThrottlerStorage } from '@nestjs/throttler';
import type { Redis } from 'ioredis';

// Fixed-window counter with an optional block period, executed atomically in Valkey.
// KEYS[1] hit counter, KEYS[2] block flag. ARGV: ttl ms, limit, block duration ms.
// Returns { hits, counterTtlMs, isBlocked, blockTtlMs }.
const INCREMENT_SCRIPT = `
local blockTtl = redis.call('PTTL', KEYS[2])
if blockTtl > 0 then
  return { tonumber(ARGV[2]) + 1, redis.call('PTTL', KEYS[1]), 1, blockTtl }
end
local hits = redis.call('INCR', KEYS[1])
if hits == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('PTTL', KEYS[1])
if hits > tonumber(ARGV[2]) then
  redis.call('SET', KEYS[2], '1', 'PX', ARGV[3])
  return { hits, ttl, 1, tonumber(ARGV[3]) }
end
return { hits, ttl, 0, 0 }
`;

/** Shared rate-limit state so limits hold across horizontally scaled API instances. */
export class ValkeyThrottlerStorage implements ThrottlerStorage {
  constructor(
    private readonly valkey: Redis,
    private readonly prefix = 'ratelimit',
  ) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ) {
    const base = `${this.prefix}:${throttlerName}:${key}`;
    const result = (await this.valkey.eval(
      INCREMENT_SCRIPT,
      2,
      `${base}:hits`,
      `${base}:block`,
      ttl,
      limit,
      blockDuration > 0 ? blockDuration : ttl,
    )) as [number, number, number, number];
    const [totalHits, ttlMs, blocked, blockMs] = result;
    return {
      totalHits,
      // The throttler API expects seconds.
      timeToExpire: Math.max(0, Math.ceil(ttlMs / 1000)),
      isBlocked: blocked === 1,
      timeToBlockExpire: Math.max(0, Math.ceil(blockMs / 1000)),
    };
  }
}
