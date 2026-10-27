import { Module } from '@nestjs/common';
import type { AppConfig } from '../../config/app-config.js';
import { APP_CONFIG } from '../../platform/index.js';
import { AiGatewayModule } from '../ai-gateway/index.js';
import { ContentModule } from '../content/index.js';
import { IdentityModule } from '../identity/index.js';
import { PracticeService } from './application/practice.service.js';
import { PronunciationService } from './application/pronunciation.service.js';
import { ReviewService } from './application/review.service.js';
import { schedulerProvider } from './application/scheduler.provider.js';
import { VocabularyStatsQuery } from './application/vocabulary-stats.query.js';
import { VocabularyService } from './application/vocabulary.service.js';
import { WordImageService } from './application/word-image.service.js';
import { PracticeController } from './http/practice.controller.js';
import { PronunciationController } from './http/pronunciation.controller.js';
import { ReviewsController } from './http/reviews.controller.js';
import { VocabularyController } from './http/vocabulary.controller.js';
import { WordImagesController } from './http/word-images.controller.js';
import { IMAGE_SEARCH, type ImageSearchProvider } from './infrastructure/image-search.js';
import { OpenverseClient } from './infrastructure/openverse.client.js';
import { WikimediaClient } from './infrastructure/wikimedia.client.js';
import { VocabularyRepository } from './infrastructure/vocabulary.repository.js';

function createImageSearch(config: AppConfig): ImageSearchProvider | null {
  switch (config.images.searchProvider) {
    case 'none':
      return null;
    case 'wikimedia':
      return new WikimediaClient();
    case 'openverse':
      return new OpenverseClient();
  }
}

@Module({
  imports: [IdentityModule, ContentModule, AiGatewayModule],
  controllers: [
    VocabularyController,
    ReviewsController,
    PracticeController,
    PronunciationController,
    WordImagesController,
  ],
  providers: [
    VocabularyRepository,
    schedulerProvider,
    VocabularyService,
    ReviewService,
    VocabularyStatsQuery,
    PracticeService,
    PronunciationService,
    WordImageService,
    { provide: IMAGE_SEARCH, inject: [APP_CONFIG], useFactory: createImageSearch },
  ],
  exports: [VocabularyStatsQuery, PracticeService],
})
export class VocabularyModule {}
