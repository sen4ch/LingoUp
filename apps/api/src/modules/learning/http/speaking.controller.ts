import { Controller, HttpCode, Post, Req } from '@nestjs/common';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  SPEAKING_AUDIO_MAX_BYTES,
  SpeakingTurnRequestSchema,
  SpeakingTurnResponseSchema,
  TranscriptionResponseSchema,
  type SpeakingTurnRequest,
} from '@lingoup/contracts';
import type { FastifyRequest } from 'fastify';
import { DomainError, ZodBody, ZodResponse } from '../../../platform/index.js';
import { AiGateway, MOCK_PROVIDER_NAME, RecognitionGateway } from '../../ai-gateway/index.js';
import { CurrentUser, UserSettingsQuery, type AuthenticatedUser } from '../../identity/index.js';

@ApiTags('learning')
@Controller('v1/learning/speaking')
export class SpeakingController {
  constructor(
    private readonly ai: AiGateway,
    private readonly recognition: RecognitionGateway,
    private readonly settings: UserSettingsQuery,
  ) {}

  @Post('turn')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ZodResponse(200, SpeakingTurnResponseSchema)
  async turn(
    @CurrentUser() user: AuthenticatedUser,
    @ZodBody(SpeakingTurnRequestSchema) body: SpeakingTurnRequest,
  ) {
    const settings = await this.settings.getForUser(user.id);
    const result = await this.ai.run(
      'speaking-tutor',
      { level: body.level ?? settings.targetLevel, topic: body.topic, messages: body.messages },
      { userId: user.id, externalSharingConsent: settings.aiDataSharing },
    );
    if (result.status !== 'ok')
      throw new DomainError('AI_UNAVAILABLE', 'The teacher is unavailable', {
        aiStatus: result.status,
      });
    return {
      reply: result.result.output.reply,
      isMock: result.result.provider === MOCK_PROVIDER_NAME,
    };
  }

  @Post('transcribe')
  @HttpCode(200)
  @ApiConsumes('audio/wav')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ZodResponse(200, TranscriptionResponseSchema)
  transcribe(@CurrentUser() user: AuthenticatedUser, @Req() request: FastifyRequest) {
    const data = request.body;
    if (!Buffer.isBuffer(data) || data.length < 44 || data.length > SPEAKING_AUDIO_MAX_BYTES)
      throw new DomainError('VALIDATION_FAILED', 'Invalid audio recording');
    return this.recognition.transcribe(user.id, data);
  }
}
