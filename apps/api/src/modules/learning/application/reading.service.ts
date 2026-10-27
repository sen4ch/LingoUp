import { Inject, Injectable } from '@nestjs/common';
import type { ReadingCompletion, ReadingCompletionsResponse } from '@lingoup/contracts';
import type { Database } from '@lingoup/database';
import { textCompletions } from '@lingoup/database/schema/learning';
import { and, desc, eq } from 'drizzle-orm';
import {
  DATABASE,
  notFound,
  OutboxWriter,
  PersonalDataRegistry,
  type PersonalDataExporter,
} from '../../../platform/index.js';
import { ContentQuery } from '../../content/index.js';

@Injectable()
export class ReadingService implements PersonalDataExporter {
  readonly section = 'learning';

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly content: ContentQuery,
    private readonly outbox: OutboxWriter,
    personalData: PersonalDataRegistry,
  ) {
    personalData.register(this);
  }

  /** Marks a text as read. Idempotent: the event is emitted only the first time. */
  async complete(userId: string, slug: string): Promise<ReadingCompletion> {
    const text = await this.content.findTextRef(slug, userId);
    if (!text) throw notFound('Text');
    return this.db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(textCompletions)
        .values({ userId, textId: text.id, textSlug: text.slug })
        .onConflictDoNothing()
        .returning();
      if (inserted) {
        await this.outbox.append(tx, {
          type: 'LessonCompleted',
          version: 1,
          userId,
          payload: { lessonType: 'reading', textId: text.id, level: text.level },
        });
        return { textSlug: inserted.textSlug, completedAt: inserted.completedAt.toISOString() };
      }
      const [existing] = await tx
        .select({ completedAt: textCompletions.completedAt })
        .from(textCompletions)
        .where(and(eq(textCompletions.userId, userId), eq(textCompletions.textId, text.id)));
      return { textSlug: text.slug, completedAt: existing!.completedAt.toISOString() };
    });
  }

  async completions(userId: string): Promise<ReadingCompletionsResponse> {
    const rows = await this.db
      .select({ textSlug: textCompletions.textSlug, completedAt: textCompletions.completedAt })
      .from(textCompletions)
      .where(eq(textCompletions.userId, userId))
      .orderBy(desc(textCompletions.completedAt));
    return {
      items: rows.map((row) => ({
        textSlug: row.textSlug,
        completedAt: row.completedAt.toISOString(),
      })),
    };
  }

  async exportUserData(userId: string): Promise<unknown> {
    return { textCompletions: (await this.completions(userId)).items };
  }
}
