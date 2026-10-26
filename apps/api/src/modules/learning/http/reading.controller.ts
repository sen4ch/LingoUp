import { Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  ReadingCompletionSchema,
  ReadingCompletionsResponseSchema,
  SlugParamSchema,
  type ReadingCompletion,
  type ReadingCompletionsResponse,
} from '@lingoup/contracts';
import { ZodParams, ZodResponse } from '../../../platform/index.js';
import { CurrentUser, type AuthenticatedUser } from '../../identity/index.js';
import { ReadingService } from '../application/reading.service.js';

@ApiTags('learning')
@Controller('v1/learning/reading')
export class ReadingController {
  constructor(private readonly reading: ReadingService) {}

  @Get('completions')
  @ZodResponse(200, ReadingCompletionsResponseSchema)
  completions(@CurrentUser() user: AuthenticatedUser): Promise<ReadingCompletionsResponse> {
    return this.reading.completions(user.id);
  }

  @Post(':slug/complete')
  @HttpCode(200)
  @ZodResponse(200, ReadingCompletionSchema)
  complete(
    @CurrentUser() user: AuthenticatedUser,
    @ZodParams(SlugParamSchema) params: { slug: string },
  ): Promise<ReadingCompletion> {
    return this.reading.complete(user.id, params.slug);
  }
}
