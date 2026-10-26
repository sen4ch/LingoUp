import { Controller, Delete, Get, HttpCode, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  ApiErrorSchema,
  IdParamSchema,
  ListWordsQuerySchema,
  LookupRequestSchema,
  LookupResponseSchema,
  SaveWordRequestSchema,
  UpdateWordRequestSchema,
  WordPageSchema,
  WordSchema,
  type ListWordsQuery,
  type LookupRequest,
  type LookupResponse,
  type SaveWordRequest,
  type UpdateWordRequest,
  type Word,
  type WordPage,
} from '@lingoup/contracts';
import { ZodBody, ZodParams, ZodQuery, ZodResponse } from '../../../platform/index.js';
import { CurrentUser, type AuthenticatedUser } from '../../identity/index.js';
import { VocabularyService } from '../application/vocabulary.service.js';

@ApiTags('vocabulary')
@Controller('v1/vocabulary')
export class VocabularyController {
  constructor(private readonly vocabulary: VocabularyService) {}

  /** May call the AI gateway, so it has its own tighter rate limit. */
  @Post('lookup')
  @HttpCode(200)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ZodResponse(200, LookupResponseSchema)
  lookup(
    @CurrentUser() user: AuthenticatedUser,
    @ZodBody(LookupRequestSchema) body: LookupRequest,
  ): Promise<LookupResponse> {
    return this.vocabulary.lookup(user.id, body);
  }

  @Get('words')
  @ZodResponse(200, WordPageSchema)
  list(
    @CurrentUser() user: AuthenticatedUser,
    @ZodQuery(ListWordsQuerySchema) query: ListWordsQuery,
  ): Promise<WordPage> {
    return this.vocabulary.listWords(user.id, query);
  }

  @Post('words')
  @HttpCode(201)
  @ZodResponse(201, WordSchema)
  @ZodResponse(409, ApiErrorSchema, 'Word already saved; details.wordId points to it')
  save(
    @CurrentUser() user: AuthenticatedUser,
    @ZodBody(SaveWordRequestSchema) body: SaveWordRequest,
  ): Promise<Word> {
    return this.vocabulary.saveWord(user.id, body);
  }

  @Get('words/:id')
  @ZodResponse(200, WordSchema)
  get(
    @CurrentUser() user: AuthenticatedUser,
    @ZodParams(IdParamSchema) params: { id: string },
  ): Promise<Word> {
    return this.vocabulary.getWord(user.id, params.id);
  }

  @Patch('words/:id')
  @ZodResponse(200, WordSchema)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @ZodParams(IdParamSchema) params: { id: string },
    @ZodBody(UpdateWordRequestSchema) body: UpdateWordRequest,
  ): Promise<Word> {
    return this.vocabulary.updateWord(user.id, params.id, body);
  }

  @Delete('words/:id')
  @HttpCode(204)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @ZodParams(IdParamSchema) params: { id: string },
  ): Promise<void> {
    return this.vocabulary.deleteWord(user.id, params.id);
  }
}
