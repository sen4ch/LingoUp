import { Module } from '@nestjs/common';
import { AiServiceClient } from '@lingoup/ai-sdk';
import type { AppConfig } from '../../config/app-config.js';
import { APP_CONFIG } from '../../platform/index.js';
import { AI_PROVIDER, type AIProvider } from './application/ai-provider.js';
import { AiGateway } from './application/ai-gateway.js';
import { AiQuota } from './application/ai-quota.js';
import { AiServiceProvider } from './infrastructure/ai-service-provider.js';
import { MockAIProvider } from './infrastructure/mock-ai-provider.js';

function createProvider(config: AppConfig): AIProvider | null {
  switch (config.ai.provider) {
    case 'none':
      return null;
    case 'mock':
      return new MockAIProvider();
    case 'ai-service':
      if (!config.ai.serviceToken)
        throw new Error('AI_SERVICE_TOKEN is required for AI_PROVIDER=ai-service');
      return new AiServiceProvider(
        new AiServiceClient({ baseUrl: config.ai.serviceUrl, token: config.ai.serviceToken }),
      );
  }
}

@Module({
  providers: [
    { provide: AI_PROVIDER, inject: [APP_CONFIG], useFactory: createProvider },
    AiQuota,
    AiGateway,
  ],
  exports: [AiGateway],
})
export class AiGatewayModule {}
