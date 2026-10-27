import { Inject, Injectable } from '@nestjs/common';
import type {
  CefrLevel,
  GrammarBlock,
  GrammarTopicDetail,
  GrammarTopicProgress,
  GrammarTopicSummary,
} from '@lingoup/contracts';
import type { Database, DbExecutor } from '@lingoup/database';
import { attempts, exercises, topics } from '@lingoup/database/schema/grammar';
import { and, asc, count, desc, eq, isNotNull, sql } from 'drizzle-orm';
import { DATABASE } from '../../../platform/index.js';

const LEVEL_ORDER = sql`array_position(ARRAY['A1','A2','B1','B2','C1','C2'], ${topics.level})`;

@Injectable()
export class GrammarRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async listPublished(
    level: CefrLevel | undefined,
    userId: string | null,
  ): Promise<GrammarTopicSummary[]> {
    const rows = await this.db
      .select({
        id: topics.id,
        slug: topics.slug,
        title: topics.title,
        level: topics.level,
        summary: topics.summary,
        exerciseCount: count(exercises.id),
      })
      .from(topics)
      .leftJoin(exercises, eq(exercises.topicId, topics.id))
      .where(and(isNotNull(topics.publishedAt), level ? eq(topics.level, level) : undefined))
      .groupBy(topics.id)
      .orderBy(LEVEL_ORDER, asc(topics.title));
    const progress = userId ? await this.progressByTopic(userId) : null;
    return rows.map((row) => ({
      ...row,
      level: row.level as CefrLevel,
      progress: progress ? (progress.get(row.id) ?? { attempted: 0, correct: 0 }) : null,
    }));
  }

  async findPublishedBySlug(
    slug: string,
    userId: string | null,
  ): Promise<GrammarTopicDetail | undefined> {
    const topic = await this.db.query.topics.findFirst({
      where: and(eq(topics.slug, slug), isNotNull(topics.publishedAt)),
    });
    if (!topic) return undefined;
    const items = await this.db
      .select({
        id: exercises.id,
        kind: exercises.kind,
        prompt: exercises.prompt,
        options: exercises.options,
      })
      .from(exercises)
      .where(eq(exercises.topicId, topic.id))
      .orderBy(asc(exercises.position));
    const progress = userId ? await this.progressByTopic(userId, topic.id) : null;
    return {
      id: topic.id,
      slug: topic.slug,
      title: topic.title,
      level: topic.level as CefrLevel,
      summary: topic.summary,
      exerciseCount: items.length,
      progress: progress ? (progress.get(topic.id) ?? { attempted: 0, correct: 0 }) : null,
      blocks: topic.blocks as GrammarBlock[],
      exercises: items.map((item) => ({ ...item, kind: item.kind as 'choice' | 'gap' })),
      author: topic.author,
      license: topic.license,
    };
  }

  /** Exercise with its accepted answers, only if its topic is published. */
  async findExerciseForGrading(exerciseId: string) {
    const [row] = await this.db
      .select({
        id: exercises.id,
        answers: exercises.answers,
        explanation: exercises.explanation,
      })
      .from(exercises)
      .innerJoin(topics, eq(topics.id, exercises.topicId))
      .where(and(eq(exercises.id, exerciseId), isNotNull(topics.publishedAt)));
    return row;
  }

  async insertAttempt(
    tx: DbExecutor,
    attempt: { userId: string; exerciseId: string; answer: string; correct: boolean },
  ): Promise<string> {
    const [row] = await tx.insert(attempts).values(attempt).returning({ id: attempts.id });
    return row!.id;
  }

  /** Per topic: exercises answered at least once and those whose latest answer was correct. */
  private async progressByTopic(
    userId: string,
    topicId?: string,
  ): Promise<Map<string, GrammarTopicProgress>> {
    const latest = await this.db
      .selectDistinctOn([attempts.exerciseId], {
        topicId: exercises.topicId,
        correct: attempts.correct,
      })
      .from(attempts)
      .innerJoin(exercises, eq(exercises.id, attempts.exerciseId))
      .where(and(eq(attempts.userId, userId), topicId ? eq(exercises.topicId, topicId) : undefined))
      .orderBy(attempts.exerciseId, desc(attempts.createdAt));
    const result = new Map<string, GrammarTopicProgress>();
    for (const row of latest) {
      const entry = result.get(row.topicId) ?? { attempted: 0, correct: 0 };
      entry.attempted += 1;
      if (row.correct) entry.correct += 1;
      result.set(row.topicId, entry);
    }
    return result;
  }

  async exportUser(userId: string) {
    const rows = await this.db
      .select({
        topic: topics.slug,
        prompt: exercises.prompt,
        answer: attempts.answer,
        correct: attempts.correct,
        createdAt: attempts.createdAt,
      })
      .from(attempts)
      .innerJoin(exercises, eq(exercises.id, attempts.exerciseId))
      .innerJoin(topics, eq(topics.id, exercises.topicId))
      .where(eq(attempts.userId, userId))
      .orderBy(asc(attempts.createdAt));
    return { attempts: rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })) };
  }
}
