import { Injectable } from '@nestjs/common';
import type { CefrLevel, GlossaryEntry, TextDetail, TextSummary } from '@lingoup/contracts';
import { notFound } from '../../../platform/index.js';
import { ContentRepository } from '../infrastructure/content.repository.js';

/** Public read API of the Content module (used by controllers and other modules). */
@Injectable()
export class ContentQuery {
  constructor(private readonly repository: ContentRepository) {}

  listTexts(level?: CefrLevel): Promise<TextSummary[]> {
    return this.repository.listPublished(level);
  }

  listMyTexts(userId: string): Promise<TextSummary[]> {
    return this.repository.listOwned(userId);
  }

  async getText(slug: string, viewerUserId: string | null): Promise<TextDetail> {
    const text = await this.repository.findReadableBySlug(slug, viewerUserId);
    if (!text) throw notFound('Text');
    return text;
  }

  /**
   * Lightweight reference used by other modules to store a snapshot of the text.
   * Respects privacy: another user's private text is not found.
   */
  async findTextRef(
    slug: string,
    viewerUserId: string | null,
  ): Promise<{ id: string; slug: string; level: CefrLevel } | null> {
    const text = await this.repository.findReadableBySlug(slug, viewerUserId);
    return text ? { id: text.id, slug: text.slug, level: text.level } : null;
  }

  async findGlossaryEntry(textSlug: string, normalizedTerm: string): Promise<GlossaryEntry | null> {
    return (await this.repository.findGlossaryEntry(textSlug, normalizedTerm)) ?? null;
  }
}
