import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  ReadingCheckContentSchema,
  type ReadingCheck,
  type ReadingCheckContent,
  type TextDetail,
} from '@lingoup/contracts';
import type { Database } from '@lingoup/database';
import { readingChecks } from '@lingoup/database/schema/learning';
import { and, eq } from 'drizzle-orm';
import {
  DATABASE,
  DomainError,
  notFound,
  PersonalDataRegistry,
  type PersonalDataExporter,
} from '../../../platform/index.js';
import { ContentQuery } from '../../content/index.js';
import { AiGateway, MOCK_PROVIDER_NAME } from '../../ai-gateway/index.js';
import { UserSettingsQuery } from '../../identity/index.js';
import { ReadingService } from './reading.service.js';
import { authoredReadingCheck } from '../domain/reading-checks.js';

@Injectable()
export class ReadingCheckService implements PersonalDataExporter {
  readonly section = 'readingChecks';
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly content: ContentQuery,
    private readonly ai: AiGateway,
    private readonly settings: UserSettingsQuery,
    private readonly reading: ReadingService,
    registry: PersonalDataRegistry,
  ) {
    registry.register(this);
  }

  private version(text: TextDetail) {
    return createHash('sha256')
      .update(JSON.stringify([text.level, text.title, text.paragraphs]))
      .digest('hex');
  }
  private async find(userId: string, text: TextDetail) {
    const [row] = await this.db
      .select()
      .from(readingChecks)
      .where(
        and(
          eq(readingChecks.userId, userId),
          eq(readingChecks.textId, text.id),
          eq(readingChecks.version, this.version(text)),
        ),
      );
    return row;
  }
  async get(userId: string, slug: string) {
    const text = await this.content.getText(slug, userId);
    const saved = await this.find(userId, text);
    return { check: saved ? serialize(saved, text.level) : null };
  }
  async start(userId: string, slug: string): Promise<ReadingCheck> {
    const text = await this.content.getText(slug, userId);
    const saved = await this.find(userId, text);
    if (saved) return serialize(saved, text.level);
    let content = authoredReadingCheck(text);
    let source = 'authored';
    if (!content) {
      const settings = await this.settings.getForUser(userId);
      const result = await this.ai.run(
        'reading-comprehension',
        { level: text.level, text: text.paragraphs.join('\n\n') },
        { userId, externalSharingConsent: settings.aiDataSharing },
      );
      if (result.status !== 'ok')
        throw new DomainError('AI_UNAVAILABLE', 'Reading questions are unavailable', {
          aiStatus: result.status,
        });
      if (result.result.provider === MOCK_PROVIDER_NAME)
        throw new DomainError('AI_UNAVAILABLE', 'A real AI provider is required for this text');
      content = ReadingCheckContentSchema.parse(result.result.output);
      source = 'ai';
    }
    const passage = text.paragraphs.join('\n\n');
    if (
      content.questions.some(
        (question) => !passage.includes(question.evidence) || new Set(question.options).size !== 4,
      ) ||
      new Set(content.questions.map((question) => question.question.toLowerCase())).size !==
        content.questions.length
    ) {
      throw new DomainError(
        'AI_UNAVAILABLE',
        'Questions could not be verified against the text. Please retry.',
      );
    }
    const [inserted] = await this.db
      .insert(readingChecks)
      .values({
        userId,
        textId: text.id,
        textSlug: slug,
        version: this.version(text),
        source,
        content,
      })
      .onConflictDoNothing()
      .returning();
    return serialize(inserted ?? (await this.find(userId, text))!, text.level);
  }
  async check(userId: string, slug: string, id: string, answers: number[]): Promise<ReadingCheck> {
    const text = await this.content.getText(slug, userId);
    const saved = await this.find(userId, text);
    if (!saved || saved.id !== id) throw notFound('Reading check');
    const content = ReadingCheckContentSchema.parse(saved.content);
    if (answers.length !== content.questions.length)
      throw new DomainError('VALIDATION_FAILED', 'Answer every question');
    const passed = grade(content, answers).passed;
    const answeredAt = new Date();
    return this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(readingChecks)
        .set({ answers, answeredAt })
        .where(and(eq(readingChecks.id, id), eq(readingChecks.userId, userId)))
        .returning();
      if (passed) await this.reading.complete(userId, slug, tx);
      return serialize(updated!, text.level);
    });
  }
  async exportUserData(userId: string) {
    return (await this.db.select().from(readingChecks).where(eq(readingChecks.userId, userId))).map(
      (row) => ({
        textSlug: row.textSlug,
        source: row.source,
        content: ReadingCheckContentSchema.parse(row.content),
        answers: row.answers,
        createdAt: row.createdAt.toISOString(),
        answeredAt: row.answeredAt?.toISOString() ?? null,
      }),
    );
  }
}

function grade(content: ReadingCheckContent, answers: number[]) {
  const results = content.questions.map((question, index) => ({
    correct: question.answerIndex === answers[index],
    answerIndex: question.answerIndex,
    explanation: question.explanation,
    evidence: question.evidence,
  }));
  const correct = results.filter((result) => result.correct).length;
  return {
    correct,
    total: results.length,
    score: Math.round((100 * correct) / results.length),
    passed: correct / results.length >= 0.6,
    results,
  };
}
function serialize(
  row: typeof readingChecks.$inferSelect,
  level: TextDetail['level'],
): ReadingCheck {
  const content = ReadingCheckContentSchema.parse(row.content);
  return {
    id: row.id,
    textSlug: row.textSlug,
    level,
    source: row.source as ReadingCheck['source'],
    questions: content.questions.map(({ question, options }) => ({ question, options })),
    result:
      row.answers && row.answeredAt
        ? {
            ...grade(content, row.answers),
            answers: row.answers,
            answeredAt: row.answeredAt.toISOString(),
          }
        : null,
  };
}
