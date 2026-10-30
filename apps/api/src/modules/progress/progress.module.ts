import { Module } from '@nestjs/common';
import { VocabularyModule } from '../vocabulary/index.js';
import { IdentityModule } from '../identity/index.js';
import { ProgressService } from './application/progress.service.js';
import { ProgressController } from './http/progress.controller.js';
import { MistakesController } from './http/mistakes.controller.js';
import { MistakeJournal } from './application/mistake-journal.service.js';
import { WeeklyReportService } from './application/weekly-report.service.js';

/**
 * Read side of Progress. The write side (projection of domain events into
 * progress.daily_activity) runs in apps/worker.
 */
@Module({
  imports: [VocabularyModule, IdentityModule],
  controllers: [ProgressController, MistakesController],
  providers: [ProgressService, MistakeJournal, WeeklyReportService],
  exports: [MistakeJournal, ProgressService],
})
export class ProgressModule {}
