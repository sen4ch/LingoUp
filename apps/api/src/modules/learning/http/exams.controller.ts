import { Controller, Get, Post, HttpCode, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import {
  ExamSchema,
  ExamSessionSchema,
  ExamResultSchema,
  ExamAnswersSchema,
  IdParamSchema,
  UuidSchema,
  type ExamAnswers,
} from '@lingoup/contracts';
import type { FastifyReply } from 'fastify';
import { ZodBody, ZodParams, ZodResponse } from '../../../platform/index.js';
import { CurrentUser, type AuthenticatedUser } from '../../identity/index.js';
import { ExamsService } from '../application/exams.service.js';

@ApiTags('learning')
@Controller('v1/learning/exams')
export class ExamsController {
  constructor(private readonly exams: ExamsService) {}
  @Post()
  @Throttle({ default: { limit: 4, ttl: 60_000 } })
  @ZodResponse(201, ExamSchema)
  start(@CurrentUser() user: AuthenticatedUser) {
    return this.exams.start(user.id);
  }
  @Get(':id')
  @ZodResponse(200, ExamSessionSchema)
  get(@CurrentUser() user: AuthenticatedUser, @ZodParams(IdParamSchema) params: { id: string }) {
    return this.exams.get(user.id, params.id);
  }
  @Get(':id/audio/:part')
  async audio(
    @CurrentUser() user: AuthenticatedUser,
    @ZodParams(z.object({ id: UuidSchema, part: z.coerce.number().int().min(0).max(3) }))
    params: { id: string; part: number },
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const audio = await this.exams.audio(user.id, params.id, params.part);
    reply.header('content-type', 'audio/mpeg');
    reply.header('content-length', audio.length);
    reply.header('cache-control', 'private, no-store');
    return audio;
  }
  @Post(':id/answers')
  @HttpCode(200)
  @Throttle({ default: { limit: 4, ttl: 60_000 } })
  @ZodResponse(200, ExamResultSchema)
  submit(
    @CurrentUser() user: AuthenticatedUser,
    @ZodParams(IdParamSchema) params: { id: string },
    @ZodBody(ExamAnswersSchema) body: ExamAnswers,
  ) {
    return this.exams.submit(user.id, params.id, body);
  }
}
