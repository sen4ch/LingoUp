import { Module } from '@nestjs/common';
import { ContentModule } from '../content/index.js';
import { ReadingService } from './application/reading.service.js';
import { ReadingController } from './http/reading.controller.js';

@Module({
  imports: [ContentModule],
  controllers: [ReadingController],
  providers: [ReadingService],
})
export class LearningModule {}
