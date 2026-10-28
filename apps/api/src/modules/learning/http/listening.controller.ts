import { Controller, Get, HttpCode, Post, Res } from '@nestjs/common';
import { ApiProduces, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  GenerateListeningRequestSchema,
  ListeningAnswersSchema,
  ListeningLessonSchema,
  ListeningResultSchema,
  IdParamSchema,
  type GenerateListeningRequest,
} from '@lingoup/contracts';
import type { FastifyReply } from 'fastify';
import { ZodBody, ZodParams, ZodResponse } from '../../../platform/index.js';
import { CurrentUser, type AuthenticatedUser } from '../../identity/index.js';
import { ListeningService } from '../application/listening.service.js';

@ApiTags('learning')
@Controller('v1/learning/listening')
export class ListeningController {
  constructor(private readonly listening: ListeningService) {}
  @Post()
  @HttpCode(201)
  @Throttle({ default: { limit: 4, ttl: 60_000 } })
  @ZodResponse(201, ListeningLessonSchema)
  generate(
    @CurrentUser() user: AuthenticatedUser,
    @ZodBody(GenerateListeningRequestSchema) body: GenerateListeningRequest,
  ) {
    return this.listening.generate(user.id, body);
  }

  @Get(':id/audio')
  @ApiProduces('audio/mpeg')
  async audio(
    @CurrentUser() user: AuthenticatedUser,
    @ZodParams(IdParamSchema) params: { id: string },
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const data = await this.listening.audioFile(user.id, params.id);
    reply.header('content-type', 'audio/mpeg');
    reply.header('cache-control', 'private, no-store');
    return data;
  }

  @Post(':id/answers')
  @HttpCode(200)
  @ZodResponse(200, ListeningResultSchema)
  check(
    @CurrentUser() user: AuthenticatedUser,
    @ZodParams(IdParamSchema) params: { id: string },
    @ZodBody(ListeningAnswersSchema) body: { answers: number[] },
  ) {
    return this.listening.check(user.id, params.id, body.answers);
  }
}
