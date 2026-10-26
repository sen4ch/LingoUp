import { Controller, Get, HttpCode, Inject, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Database } from '@lingoup/database';
import { sql } from 'drizzle-orm';
import type { Redis } from 'ioredis';
import { Public } from '../http/public.decorator.js';
import { DATABASE, VALKEY } from '../tokens.js';

@ApiTags('health')
@Public()
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(VALKEY) private readonly valkey: Redis,
  ) {}

  /** Liveness: the process is up. Never checks dependencies (avoids restart cascades). */
  @Get('live')
  @HttpCode(200)
  live() {
    return { status: 'ok' };
  }

  /** Readiness: dependencies are reachable, the instance may receive traffic. */
  @Get('ready')
  async ready() {
    const [database, valkey] = await Promise.all([
      this.db.execute(sql`select 1`).then(
        () => 'ok' as const,
        () => 'down' as const,
      ),
      this.valkey.ping().then(
        () => 'ok' as const,
        () => 'down' as const,
      ),
    ]);
    const checks = { database, valkey };
    if (database !== 'ok' || valkey !== 'ok') {
      throw new ServiceUnavailableException({ status: 'unavailable', checks });
    }
    return { status: 'ok', checks };
  }
}
