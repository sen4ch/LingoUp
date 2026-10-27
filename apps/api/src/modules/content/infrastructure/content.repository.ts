import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type {
  CefrLevel,
  ContentProvenance,
  GlossaryEntry,
  TextDetail,
  TextSummary,
} from '@lingoup/contracts';
import type { Database } from '@lingoup/database';
import { glossaryEntries, texts } from '@lingoup/database/schema/content';
import { estimateReadingMinutes } from '@lingoup/learning-engine';
import { and, asc, desc, eq, getTableColumns, isNotNull, isNull, or, sql } from 'drizzle-orm';
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

  /** Public library only: private texts never appear here. */
  async listPublished(level?: CefrLevel): Promise<TextSummary[]> {
    const { paragraphs: _omit, ...columns } = getTableColumns(texts);
    const rows = await this.db
      .select(columns)
      .from(texts)
      .where(
        and(
          isNotNull(texts.publishedAt),
          isNull(texts.ownerUserId),
          level ? eq(texts.level, level) : undefined,
        ),
      )
      .orderBy(LEVEL_ORDER, asc(texts.title));
    return rows.map(toSummary);
  }

  async listOwned(userId: string): Promise<TextSummary[]> {
    const { paragraphs: _omit, ...columns } = getTableColumns(texts);
    const rows = await this.db
      .select(columns)
      .from(texts)
      .where(eq(texts.ownerUserId, userId))
      .orderBy(desc(texts.createdAt));
    return rows.map(toSummary);
  }

  /**
   * A published library text, or a private text when the viewer is its owner.
   * Someone else's private text is reported as missing (no existence leak).
   */
  async findReadableBySlug(
    slug: string,
    viewerUserId: string | null,
  ): Promise<TextDetail | undefined> {
    const row = await this.db.query.texts.findFirst({
      where: and(
        eq(texts.slug, slug),
        isNotNull(texts.publishedAt),
        viewerUserId
          ? or(isNull(texts.ownerUserId), eq(texts.ownerUserId, viewerUserId))
          : isNull(texts.ownerUserId),
      ),
    });
    if (!row) return undefined;
    return {
      ...toSummary(row),
      paragraphs: row.paragraphs,
      author: row.author,
      license: row.license,
      provenance: row.provenance as ContentProvenance,
      isPrivate: row.ownerUserId !== null,
      focusTerms: row.focusTerms,
    };
  }

  async insertPrivateText(values: {
    ownerUserId: string;
    slug: string;
    title: string;
    level: CefrLevel;
    summary: string;
    paragraphs: string[];
    wordCount: number;
    author: string;
    license: string;
    provenance: ContentProvenance;
    focusTerms: string[];
    topics: string[];
  }): Promise<void> {
    await this.db.insert(texts).values({
      ...values,
      contentHash: createHash('sha256').update(values.paragraphs.join('\n')).digest('hex'),
      publishedAt: new Date(),
    });
  }

  async deleteOwned(userId: string, slug: string): Promise<boolean> {
    const deleted = await this.db
      .delete(texts)
      .where(and(eq(texts.slug, slug), eq(texts.ownerUserId, userId)))
      .returning({ id: texts.id });
    return deleted.length > 0;
  }

  async exportOwned(userId: string) {
    const rows = await this.db.query.texts.findMany({
      where: eq(texts.ownerUserId, userId),
      orderBy: asc(texts.createdAt),
    });
    return rows.map((row) => ({
      slug: row.slug,
      title: row.title,
      level: row.level,
      paragraphs: row.paragraphs,
      focusTerms: row.focusTerms,
      provenance: row.provenance,
      createdAt: row.createdAt.toISOString(),
    }));
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
