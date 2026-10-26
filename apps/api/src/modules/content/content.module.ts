import { Module } from '@nestjs/common';
import { ContentQuery } from './application/content.query.js';
import { TextsController } from './http/texts.controller.js';
import { ContentRepository } from './infrastructure/content.repository.js';

@Module({
  controllers: [TextsController],
  providers: [ContentRepository, ContentQuery],
  exports: [ContentQuery],
})
export class ContentModule {}
