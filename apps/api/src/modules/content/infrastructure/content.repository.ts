import { Inject, Injectable } from '@nestjs/common';
import type { CefrLevel, GlossaryEntry, TextDetail, TextSummary } from '@lingoup/contracts';
import type { Database } from '@lingoup/database';
import { glossaryEntries, texts } from '@lingoup/database/schema/content';
import { estimateReadingMinutes } from '@lingoup/learning-engine';
import { and, asc, eq, getTableColumns, isNotNull, sql } from 'drizzle-orm';
import { DATABASE } from '../../../platform/index.js';

type TextRow = typeof texts.$inferSelect;

const LEVEL_ORDER = sql`array_position(ARRAY['A1','A2','B1','B2','C1','C2'], ${texts.level})`;

function toSummary(row: Omit<TextRow, 'paragraphs'>): TextSummary {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    level: row.level as CefrLevel,
    summary: row.summary,
    wordCount: row.wordCount,
    estimatedMinutes: estimateReadingMinutes(row.wordCount),
    topics: row.topics,
  };
}

@Injectable()
export class ContentRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async listPublished(level?: CefrLevel): Promise<TextSummary[]> {
    const { paragraphs: _omit, ...columns } = getTableColumns(texts);
    const rows = await this.db
      .select(columns)
      .from(texts)
      .where(and(isNotNull(texts.publishedAt), level ? eq(texts.level, level) : undefined))
      .orderBy(LEVEL_ORDER, asc(texts.title));
    return rows.map(toSummary);
  }

  async findPublishedBySlug(slug: string): Promise<TextDetail | undefined> {
    const row = await this.db.query.texts.findFirst({
      where: and(eq(texts.slug, slug), isNotNull(texts.publishedAt)),
    });
    if (!row) return undefined;
    return {
      ...toSummary(row),
      paragraphs: row.paragraphs,
      author: row.author,
      license: row.license,
    };
  }

  async findGlossaryEntry(
    textSlug: string,
    normalizedTerm: string,
  ): Promise<GlossaryEntry | undefined> {
    const [row] = await this.db
      .select({
        term: glossaryEntries.term,
        partOfSpeech: glossaryEntries.partOfSpeech,
        definition: glossaryEntries.definition,
        translation: glossaryEntries.translation,
        example: glossaryEntries.example,
      })
      .from(glossaryEntries)
      .innerJoin(texts, eq(texts.id, glossaryEntries.textId))
      .where(and(eq(texts.slug, textSlug), eq(glossaryEntries.normalizedTerm, normalizedTerm)));
    return row;
  }
}
