import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ListeningGenerationOutputSchema, type AiTaskOutput } from '@lingoup/ai-sdk';
import type {
  GenerateListeningRequest,
  ListeningLesson,
  ListeningResult,
} from '@lingoup/contracts';
import type { Redis } from 'ioredis';
import { DomainError, notFound, VALKEY } from '../../../platform/index.js';
import { AiGateway, ListeningAudioGateway, MOCK_PROVIDER_NAME } from '../../ai-gateway/index.js';
import { UserSettingsQuery } from '../../identity/index.js';
import { PracticeEvents } from './practice-events.service.js';

const TTL = 24 * 60 * 60;
interface StoredLesson {
  lesson: ListeningLesson;
  content: AiTaskOutput<'listening-generation'>;
}

@Injectable()
export class ListeningService {
  constructor(
    private readonly ai: AiGateway,
    private readonly audio: ListeningAudioGateway,
    private readonly settings: UserSettingsQuery,
    @Inject(VALKEY) private readonly cache: Redis,
    private readonly practice: PracticeEvents,
  ) {}
  private key(userId: string, id: string) {
    return `listening:v1:${userId}:${id}`;
  }

  async generate(userId: string, input: GenerateListeningRequest): Promise<ListeningLesson> {
    const settings = await this.settings.getForUser(userId);
    const result = await this.ai.run(
      'listening-generation',
      { level: input.level, topic: input.topic || 'Everyday life' },
      { userId, externalSharingConsent: settings.aiDataSharing },
    );
    if (result.status !== 'ok')
      throw new DomainError('AI_UNAVAILABLE', 'Listening generation unavailable', {
        aiStatus: result.status,
      });
    const content = result.result.output;
    const { data, durationSeconds } = await this.audio.synthesize(
      userId,
      content.script,
      input.level,
    );
    const lesson: ListeningLesson = {
      id: randomUUID(),
      title: content.title,
      level: input.level,
      durationSeconds,
      questions: content.questions.map(({ question, options }) => ({ question, options })),
      expiresAt: new Date(Date.now() + TTL * 1000).toISOString(),
      isMock: result.result.provider === MOCK_PROVIDER_NAME,
    };
    const saved = await this.cache
      .multi()
      .set(`${this.key(userId, lesson.id)}:audio`, data, 'EX', TTL)
      .set(this.key(userId, lesson.id), JSON.stringify({ lesson, content }), 'EX', TTL)
      .exec();
    if (!saved || saved.some(([error]) => error))
      throw new DomainError('AI_UNAVAILABLE', 'Could not store the lesson');
    return lesson;
  }

  async audioFile(userId: string, id: string) {
    const audio = await this.cache.getBuffer(`${this.key(userId, id)}:audio`);
    if (!audio) throw notFound('Listening audio');
    return audio;
  }

  async check(userId: string, id: string, answers: number[]): Promise<ListeningResult> {
    const json = await this.cache.get(this.key(userId, id));
    if (!json) throw notFound('Listening lesson');
    const stored = JSON.parse(json) as StoredLesson;
    const content = ListeningGenerationOutputSchema.parse(stored.content);
    if (answers.length !== content.questions.length)
      throw new DomainError('VALIDATION_FAILED', 'Answer every question');
    const results = content.questions.map((question, index) => ({
      correct: question.answerIndex === answers[index],
      answerIndex: question.answerIndex,
      explanation: question.explanation,
      evidence: question.evidence,
    }));
    const correct = results.filter((result) => result.correct).length;
    if (!stored.lesson.isMock && correct / results.length >= 0.6)
      await this.practice.complete(userId, 'listening', `listening:${id}`);
    return {
      correct,
      total: results.length,
      transcript: content.script,
      results,
    };
  }
}
