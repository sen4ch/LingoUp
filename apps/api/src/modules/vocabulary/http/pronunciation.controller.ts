import { Controller, Get, Res, Inject } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { AppConfig } from '../../../config/app-config.js';
import { APP_CONFIG } from '../../../platform/index.js';
import { ApiProduces, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  ApiErrorSchema,
  PronunciationQuerySchema,
  type PronunciationQuery,
} from '@lingoup/contracts';
import type { FastifyReply } from 'fastify';
import { ZodQuery, ZodResponse } from '../../../platform/index.js';
import { SPEECH_AUDIO_TYPE } from '../../ai-gateway/index.js';
import { CurrentUser, type AuthenticatedUser } from '../../identity/index.js';
import { PronunciationService } from '../application/pronunciation.service.js';

@ApiTags('vocabulary')
@Controller('v1/vocabulary/pronunciation')
export class PronunciationController {
  constructor(
    private readonly pronunciation: PronunciationService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Get('settings')
  settings(@Res({ passthrough: true }) reply: FastifyReply) {
    const provider = this.config.speech.provider;
    const local = provider.startsWith('piper-');
    reply.header('cache-control', 'private, no-store');
    return {
      enabled: provider !== 'none',
      local,
      prefetchAllowed: local || provider === 'edge',
      revision: createHash('sha256')
        .update(
          `${provider}:${this.config.speech.voice}:${this.config.installation.revision ?? ''}`,
        )
        .digest('hex'),
    };
  }

  /** GET so an <audio> element can play it directly; the browser caches the response. */
  @Get()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiProduces(SPEECH_AUDIO_TYPE)
  @ZodResponse(
    503,
    ApiErrorSchema,
    'Speech is disabled, needs consent, or failed; details.aiStatus says which',
  )
  async audio(
    @CurrentUser() user: AuthenticatedUser,
    @ZodQuery(PronunciationQuerySchema) query: PronunciationQuery,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<Buffer> {
    const audio = await this.pronunciation.audio(user.id, query);
    reply.header('content-type', SPEECH_AUDIO_TYPE);
    // Revalidate after a voice change; the synthesis cache still avoids regeneration.
    reply.header('cache-control', 'private, no-cache');
    return audio;
  }
}
