import { Module } from '@nestjs/common';
import { ProgressModule } from '../progress/index.js';
import { GrammarModule } from '../grammar/index.js';
import { NextPracticeController } from './http/next-practice.controller.js';
import { NextPracticeService } from './application/next-practice.service.js';
import { ExamsController } from './http/exams.controller.js';
import { ExamsService } from './application/exams.service.js';
import { PracticeEvents } from './application/practice-events.service.js';
import { WritingController } from './http/writing.controller.js';
import { AiGatewayModule } from '../ai-gateway/index.js';
import { ContentModule } from '../content/index.js';
import { IdentityModule } from '../identity/index.js';
import { VocabularyModule } from '../vocabulary/index.js';
import { ReadingService } from './application/reading.service.js';
import { ReadingCheckService } from './application/reading-check.service.js';
import { TextGenerationService } from './application/text-generation.service.js';
import { ReadingController } from './http/reading.controller.js';
import { TextGenerationController } from './http/text-generation.controller.js';
import { SpeakingController } from './http/speaking.controller.js';
import { ListeningController } from './http/listening.controller.js';
import { ListeningService } from './application/listening.service.js';

@Module({
  imports: [
    ContentModule,
    VocabularyModule,
    IdentityModule,
    AiGatewayModule,
    ProgressModule,
    GrammarModule,
  ],
  controllers: [
    NextPracticeController,
    ExamsController,
    WritingController,
    ReadingController,
    TextGenerationController,
    SpeakingController,
    ListeningController,
  ],
  providers: [
    NextPracticeService,
    ReadingService,
    ReadingCheckService,
    TextGenerationService,
    ListeningService,
    ExamsService,
    PracticeEvents,
  ],
})
export class LearningModule {}
