import { Module } from '@nestjs/common';
import { ProgressModule } from '../progress/index.js';
import { GrammarService } from './application/grammar.service.js';
import { GrammarController } from './http/grammar.controller.js';
import { GrammarRepository } from './infrastructure/grammar.repository.js';

@Module({
  imports: [ProgressModule],
  controllers: [GrammarController],
  providers: [GrammarRepository, GrammarService],
  exports: [GrammarService],
})
export class GrammarModule {}
