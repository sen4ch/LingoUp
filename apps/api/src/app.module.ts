import { Module, type DynamicModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import type { Redis } from 'ioredis';
import type { AppConfig } from './config/app-config.js';
import { AiGatewayModule } from './modules/ai-gateway/index.js';
import { ContentModule } from './modules/content/index.js';
import { GrammarModule } from './modules/grammar/index.js';
import { IdentityModule } from './modules/identity/index.js';
import { LearningModule } from './modules/learning/index.js';
import { ProgressModule } from './modules/progress/index.js';
import { VocabularyModule } from './modules/vocabulary/index.js';
import { PlatformModule } from './platform/platform.module.js';
import { clientRateLimitKey } from './platform/rate-limit/client-key.js';
import { ValkeyThrottlerStorage } from './platform/rate-limit/valkey-throttler-storage.js';
import { VALKEY } from './platform/tokens.js';

@Module({})
export class AppModule {
  static register(config: AppConfig): DynamicModule {
    return {
      module: AppModule,
      imports: [
        PlatformModule.register(config),
        ThrottlerModule.forRootAsync({
          inject: [VALKEY],
          useFactory: (valkey: Redis) => ({
            throttlers: [{ name: 'default', ttl: 60_000, limit: config.http.rateLimitPerMinute }],
            storage: new ValkeyThrottlerStorage(valkey),
            // request.ip honours TRUST_PROXY; IPv6 clients are grouped by /64.
            getTracker: (request: Record<string, unknown>) =>
              Promise.resolve(clientRateLimitKey(String(request.ip))),
          }),
        }),
        IdentityModule,
        ContentModule,
        AiGatewayModule,
        VocabularyModule,
        LearningModule,
        GrammarModule,
        ProgressModule,
      ],
      providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
    };
  }
}
