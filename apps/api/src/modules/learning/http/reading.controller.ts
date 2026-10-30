import { Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  ReadingCompletionSchema,
  ReadingCompletionsResponseSchema,
  SlugParamSchema,
  type ReadingCompletion,
  type ReadingCompletionsResponse,
  ReadingCheckSchema,
  ReadingCheckStateSchema,
  ReadingCheckAnswersSchema,
  SlugSchema,
  UuidSchema,
} from '@lingoup/contracts';
import { ZodBody, ZodParams, ZodResponse } from '../../../platform/index.js';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { CurrentUser, type AuthenticatedUser } from '../../identity/index.js';
import { ReadingService } from '../application/reading.service.js';
import { ReadingCheckService } from '../application/reading-check.service.js';

const CheckParamsSchema = z.object({ slug: SlugSchema, id: UuidSchema });

@ApiTags('learning')
@Controller('v1/learning/reading')
export class ReadingController {
  constructor(
    private readonly reading: ReadingService,
    private readonly checks: ReadingCheckService,
  ) {}

  @Get(':slug/check')
  @ZodResponse(200, ReadingCheckStateSchema)
  checkState(
    @CurrentUser() user: AuthenticatedUser,
    @ZodParams(SlugParamSchema) params: { slug: string },
  ) {
    return this.checks.get(user.id, params.slug);
  }

  @Post(':slug/check')
  @HttpCode(200)
  @Throttle({ default: { limit: 12, ttl: 60_000 } })
  @ZodResponse(200, ReadingCheckSchema)
  startCheck(
    @CurrentUser() user: AuthenticatedUser,
    @ZodParams(SlugParamSchema) params: { slug: string },
  ) {
    return this.checks.start(user.id, params.slug);
  }

  @Post(':slug/check/:id/answers')
  @HttpCode(200)
  @ZodResponse(200, ReadingCheckSchema)
  answerCheck(
    @CurrentUser() user: AuthenticatedUser,
    @ZodParams(CheckParamsSchema) params: { slug: string; id: string },
    @ZodBody(ReadingCheckAnswersSchema) body: { answers: number[] },
  ) {
    return this.checks.check(user.id, params.slug, params.id, body.answers);
  }

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
