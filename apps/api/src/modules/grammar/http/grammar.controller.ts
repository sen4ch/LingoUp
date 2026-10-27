import { Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  GrammarAnswerResultSchema,
  GrammarTopicDetailSchema,
  IdParamSchema,
  ListGrammarTopicsQuerySchema,
  ListGrammarTopicsResponseSchema,
  SlugParamSchema,
  SubmitGrammarAnswerRequestSchema,
  type GrammarAnswerResult,
  type GrammarTopicDetail,
  type ListGrammarTopicsQuery,
  type ListGrammarTopicsResponse,
  type SubmitGrammarAnswerRequest,
} from '@lingoup/contracts';
import type { FastifyRequest } from 'fastify';
import { Public, ZodBody, ZodParams, ZodQuery, ZodResponse } from '../../../platform/index.js';
import { CurrentUser, type AuthenticatedUser } from '../../identity/index.js';
import { GrammarService } from '../application/grammar.service.js';

@ApiTags('grammar')
@Controller('v1/grammar')
export class GrammarController {
  constructor(private readonly grammar: GrammarService) {}

  /** Public; includes the learner's progress when a session is present. */
  @Public()
  @Get('topics')
  @ZodResponse(200, ListGrammarTopicsResponseSchema)
  async list(
    @ZodQuery(ListGrammarTopicsQuerySchema) query: ListGrammarTopicsQuery,
    @Req() request: FastifyRequest,
  ): Promise<ListGrammarTopicsResponse> {
    return { items: await this.grammar.listTopics(query.level, request.user?.id ?? null) };
  }

  @Public()
  @Get('topics/:slug')
  @ZodResponse(200, GrammarTopicDetailSchema)
  get(
    @ZodParams(SlugParamSchema) params: { slug: string },
    @Req() request: FastifyRequest,
  ): Promise<GrammarTopicDetail> {
    return this.grammar.getTopic(params.slug, request.user?.id ?? null);
  }

  @Post('exercises/:id/attempts')
  @HttpCode(200)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ZodResponse(200, GrammarAnswerResultSchema)
  submit(
    @CurrentUser() user: AuthenticatedUser,
    @ZodParams(IdParamSchema) params: { id: string },
    @ZodBody(SubmitGrammarAnswerRequestSchema) body: SubmitGrammarAnswerRequest,
  ): Promise<GrammarAnswerResult> {
    return this.grammar.submitAnswer(user.id, params.id, body.answer);
  }
}
