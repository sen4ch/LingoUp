import { Module } from '@nestjs/common';
import { VocabularyModule } from '../vocabulary/index.js';
import { ProgressService } from './application/progress.service.js';
import { ProgressController } from './http/progress.controller.js';

/**
 * Read side of Progress. The write side (projection of domain events into
 * progress.daily_activity) runs in apps/worker.
 */
@Module({
  imports: [VocabularyModule],
  controllers: [ProgressController],
  providers: [ProgressService],
})
export class ProgressModule {}
