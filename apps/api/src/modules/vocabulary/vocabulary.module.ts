import { Module } from '@nestjs/common';
import { AiGatewayModule } from '../ai-gateway/index.js';
import { ContentModule } from '../content/index.js';
import { IdentityModule } from '../identity/index.js';
import { PracticeService } from './application/practice.service.js';
import { PronunciationService } from './application/pronunciation.service.js';
import { ReviewService } from './application/review.service.js';
import { schedulerProvider } from './application/scheduler.provider.js';
import { VocabularyStatsQuery } from './application/vocabulary-stats.query.js';
import { VocabularyService } from './application/vocabulary.service.js';
import { PracticeController } from './http/practice.controller.js';
import { PronunciationController } from './http/pronunciation.controller.js';
import { ReviewsController } from './http/reviews.controller.js';
import { VocabularyController } from './http/vocabulary.controller.js';
import { VocabularyRepository } from './infrastructure/vocabulary.repository.js';

@Module({
  imports: [IdentityModule, ContentModule, AiGatewayModule],
  controllers: [
    VocabularyController,
    ReviewsController,
    PracticeController,
    PronunciationController,
  ],
  providers: [
    VocabularyRepository,
    schedulerProvider,
    VocabularyService,
    ReviewService,
    VocabularyStatsQuery,
    PracticeService,
    PronunciationService,
  ],
  exports: [VocabularyStatsQuery, PracticeService],
})
export class VocabularyModule {}
