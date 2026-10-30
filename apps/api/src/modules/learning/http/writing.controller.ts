import { Controller, HttpCode, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  WritingTurnRequestSchema,
  WritingTurnResponseSchema,
  type WritingTurnRequest,
} from '@lingoup/contracts';
import { DomainError, ZodBody, ZodResponse } from '../../../platform/index.js';
import { AiGateway, MOCK_PROVIDER_NAME } from '../../ai-gateway/index.js';
import { CurrentUser, UserSettingsQuery, type AuthenticatedUser } from '../../identity/index.js';
import { PracticeEvents } from '../application/practice-events.service.js';
import { MistakeJournal } from '../../progress/index.js';

@ApiTags('learning')
@Controller('v1/learning/writing')
export class WritingController {
  constructor(
    private readonly ai: AiGateway,
    private readonly settings: UserSettingsQuery,
    private readonly practice: PracticeEvents,
    private readonly journal: MistakeJournal,
  ) {}

  @Post('turn')
  @HttpCode(200)
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  @ZodResponse(200, WritingTurnResponseSchema)
  async turn(
    @CurrentUser() user: AuthenticatedUser,
    @ZodBody(WritingTurnRequestSchema) body: WritingTurnRequest,
  ) {
    const settings = await this.settings.getForUser(user.id);
    const result = await this.ai.run(
      'writing-assessment',
      {
        ...body,
        level: body.level ?? settings.targetLevel,
      },
      { userId: user.id, externalSharingConsent: settings.aiDataSharing },
    );
    if (result.status !== 'ok')
      throw new DomainError('AI_UNAVAILABLE', 'Writing tutor unavailable', {
        aiStatus: result.status,
      });
    const isMock = result.result.provider === MOCK_PROVIDER_NAME;
    const reply = body.messages.at(-1);
    if (!isMock && reply?.role === 'user')
      await this.journal.record(user.id, {
        source: 'writing',
        sourceKey: JSON.stringify(body.messages),
        text: reply.content,
        context: body.topic,
        sourceHref: '/writing',
        issues: result.result.output.issues,
      });
    if (!isMock && reply?.role === 'user' && reply.content.trim().length >= 20) {
      await this.practice.complete(
        user.id,
        'writing',
        this.practice.dailyKey(
          'writing',
          body.messages
            .slice(-2)
            .map((message) => message.content)
            .join('\n'),
        ),
      );
    }
    return { ...result.result.output, isMock };
  }
}
