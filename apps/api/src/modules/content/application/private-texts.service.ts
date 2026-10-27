import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { AI_GENERATED_CONTENT_LICENSE, type CefrLevel } from '@lingoup/contracts';
import { countWords } from '@lingoup/learning-engine';
import {
  notFound,
  PersonalDataRegistry,
  type PersonalDataExporter,
} from '../../../platform/index.js';
import { ContentRepository } from '../infrastructure/content.repository.js';

export interface NewGeneratedText {
  ownerUserId: string;
  level: CefrLevel;
  title: string;
  summary: string;
  paragraphs: string[];
  focusTerms: string[];
}

const GENERATED_AUTHOR = 'AI-generated for you (no human author)';
const HTML_TAGS = /<\/?[a-z][^>]*>/gi;

function slugFor(title: string): string {
  const base = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
  return `my-${base || 'text'}-${randomBytes(4).toString('hex')}`;
}

/** Public write API of the Content module for private, per-user texts. */
@Injectable()
export class PrivateTextsService implements PersonalDataExporter {
  readonly section = 'privateTexts';

  constructor(
    private readonly repository: ContentRepository,
    personalData: PersonalDataRegistry,
  ) {
    personalData.register(this);
  }

  /**
   * Stores an AI-generated text visible only to its owner. Model output is untrusted:
   * HTML is stripped of tags so the reader keeps rendering plain text only.
   */
  async createGenerated(text: NewGeneratedText): Promise<{ slug: string }> {
    const clean = (value: string) => value.replace(HTML_TAGS, '').replace(/\s+/g, ' ').trim();
    const paragraphs = text.paragraphs.map(clean).filter(Boolean);
    const slug = slugFor(text.title);
    await this.repository.insertPrivateText({
      ownerUserId: text.ownerUserId,
      slug,
      title: clean(text.title).slice(0, 120) || 'Practice text',
      level: text.level,
      summary: clean(text.summary).slice(0, 300),
      paragraphs,
      wordCount: paragraphs.reduce((sum, paragraph) => sum + countWords(paragraph), 0),
      author: GENERATED_AUTHOR,
      license: AI_GENERATED_CONTENT_LICENSE,
      provenance: 'ai-generated',
      focusTerms: text.focusTerms,
      topics: ['generated'],
    });
    return { slug };
  }

  async deleteOwned(userId: string, slug: string): Promise<void> {
    if (!(await this.repository.deleteOwned(userId, slug))) throw notFound('Text');
  }

  exportUserData(userId: string): Promise<unknown> {
    return this.repository.exportOwned(userId);
  }
}
