import { Module } from '@nestjs/common';
import { ContentQuery } from './application/content.query.js';
import { PrivateTextsService } from './application/private-texts.service.js';
import { TextsController } from './http/texts.controller.js';
import { ContentRepository } from './infrastructure/content.repository.js';

@Module({
  controllers: [TextsController],
  providers: [ContentRepository, ContentQuery, PrivateTextsService],
  exports: [ContentQuery, PrivateTextsService],
})
export class ContentModule {}
