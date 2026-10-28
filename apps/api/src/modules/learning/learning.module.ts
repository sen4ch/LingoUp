import { Module } from '@nestjs/common';
import { AiGatewayModule } from '../ai-gateway/index.js';
import { ContentModule } from '../content/index.js';
import { IdentityModule } from '../identity/index.js';
import { VocabularyModule } from '../vocabulary/index.js';
import { ReadingService } from './application/reading.service.js';
import { TextGenerationService } from './application/text-generation.service.js';
import { ReadingController } from './http/reading.controller.js';
import { TextGenerationController } from './http/text-generation.controller.js';
import { SpeakingController } from './http/speaking.controller.js';
import { ListeningController } from './http/listening.controller.js';
import { ListeningService } from './application/listening.service.js';

@Module({
  imports: [ContentModule, VocabularyModule, IdentityModule, AiGatewayModule],
  controllers: [
    ReadingController,
    TextGenerationController,
    SpeakingController,
    ListeningController,
  ],
  providers: [ReadingService, TextGenerationService, ListeningService],
})
export class LearningModule {}
