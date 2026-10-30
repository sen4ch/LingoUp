import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { MistakeEntry, MistakeQuery, WritingIssue } from '@lingoup/contracts';
import type { Database, DbExecutor } from '@lingoup/database';
import { mistakeEntries } from '@lingoup/database/schema/progress';
import { and, count, desc, eq, isNull, isNotNull, lt } from 'drizzle-orm';
import {
  DATABASE,
  notFound,
  PersonalDataRegistry,
  type PersonalDataExporter,
} from '../../../platform/index.js';

type Correction = Pick<
  WritingIssue,
  'quote' | 'replacement' | 'category' | 'explanation' | 'example' | 'alternatives'
> & { errorType?: string | null };
export interface JournalFeedback {
  source: MistakeEntry['source'];
  sourceKey: string;
  text: string;
  context: string;
  sourceHref: string;
  issues: Correction[];
}

@Injectable()
export class MistakeJournal implements PersonalDataExporter {
  readonly section = 'mistakes';
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    registry: PersonalDataRegistry,
  ) {
    registry.register(this);
  }

  async record(userId: string, feedback: JournalFeedback, tx: DbExecutor = this.db) {
    const entries = feedback.issues
      .filter((issue) => feedback.text.includes(issue.quote) && issue.quote !== issue.replacement)
      .slice(0, 50)
      .map((issue) => ({
        userId,
        fingerprint: createHash('sha256')
          .update(
            feedback.source === 'grammar'
              ? feedback.sourceKey
              : JSON.stringify([
                  feedback.source,
                  feedback.sourceKey,
                  issue.quote,
                  issue.replacement,
                  issue.category,
                  issue.errorType ?? null,
                ]),
          )
          .digest('hex'),
        source: feedback.source,
        category: issue.category,
        errorType: issue.errorType ?? null,
        original: issue.quote,
        corrected: issue.replacement,
        explanation: issue.explanation.slice(0, 1000),
        example: issue.example ?? null,
        alternatives: issue.alternatives ?? [],
        context: feedback.context.slice(0, 1000),
        sourceHref: feedback.sourceHref,
      }));
    if (entries.length) await tx.insert(mistakeEntries).values(entries).onConflictDoNothing();
  }

  async list(userId: string, query: MistakeQuery) {
    const [rows, totals] = await Promise.all([
      this.db
        .select()
        .from(mistakeEntries)
        .where(
          and(
            eq(mistakeEntries.userId, userId),
            query.source ? eq(mistakeEntries.source, query.source) : undefined,
            query.category ? eq(mistakeEntries.category, query.category) : undefined,
            query.status === 'open'
              ? isNull(mistakeEntries.resolvedAt)
              : query.status === 'resolved'
                ? isNotNull(mistakeEntries.resolvedAt)
                : undefined,
            query.cursor ? lt(mistakeEntries.id, query.cursor) : undefined,
          ),
        )
        .orderBy(desc(mistakeEntries.id))
        .limit(query.limit + 1),
      this.db
        .select({ resolved: isNotNull(mistakeEntries.resolvedAt), total: count() })
        .from(mistakeEntries)
        .where(eq(mistakeEntries.userId, userId))
        .groupBy(isNotNull(mistakeEntries.resolvedAt)),
    ]);
    const items = rows.slice(0, query.limit).map(serialize);
    return {
      items,
      nextCursor: rows.length > query.limit ? items.at(-1)!.id : null,
      counts: {
        open: totals.find((row) => !row.resolved)?.total ?? 0,
        resolved: totals.find((row) => row.resolved)?.total ?? 0,
      },
    };
  }

  async resolve(userId: string, id: string, resolved: boolean): Promise<MistakeEntry> {
    const [entry] = await this.db
      .update(mistakeEntries)
      .set({ resolvedAt: resolved ? new Date() : null })
      .where(and(eq(mistakeEntries.userId, userId), eq(mistakeEntries.id, id)))
      .returning();
    if (!entry) throw notFound('Mistake');
    return serialize(entry);
  }

  async exportUserData(userId: string) {
    return (
      await this.db.select().from(mistakeEntries).where(eq(mistakeEntries.userId, userId))
    ).map(serialize);
  }
}

function serialize(row: typeof mistakeEntries.$inferSelect): MistakeEntry {
  return {
    id: row.id,
    source: row.source as MistakeEntry['source'],
    category: row.category as MistakeEntry['category'],
    errorType: row.errorType,
    original: row.original,
    corrected: row.corrected,
    explanation: row.explanation,
    example: row.example,
    alternatives: row.alternatives,
    context: row.context,
    sourceHref: row.sourceHref,
    createdAt: row.createdAt.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
  };
}
