import { Module } from '@nestjs/common';
import { GrammarService } from './application/grammar.service.js';
import { GrammarController } from './http/grammar.controller.js';
import { GrammarRepository } from './infrastructure/grammar.repository.js';

@Module({
  controllers: [GrammarController],
  providers: [GrammarRepository, GrammarService],
})
export class GrammarModule {}
