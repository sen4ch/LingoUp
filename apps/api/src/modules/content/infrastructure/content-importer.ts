import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Database } from '@lingoup/database';
import { glossaryEntries, texts } from '@lingoup/database/schema/content';
import { eq } from 'drizzle-orm';
import { parseContentDocument, type ContentDocument } from '../domain/content-document.js';

export interface ImportReport {
  created: string[];
  updated: string[];
  unchanged: string[];
}

/**
 * Imports reading texts from `content/reading/**.md` into the content schema.
 * Idempotent: unchanged files (same SHA-256) are skipped; changed files replace the text
 * and its glossary atomically. Texts are never deleted automatically, because saved
 * words keep references to them.
 */
export class ContentImporter {
  constructor(private readonly db: Database) {}

  async importDirectory(directory: string): Promise<ImportReport> {
    const files = await this.findMarkdownFiles(directory);
    const documents: ContentDocument[] = [];
    for (const file of files) {
      documents.push(
        parseContentDocument(await readFile(file, 'utf8'), path.relative(directory, file)),
      );
    }
    const slugs = new Set<string>();
    for (const document of documents) {
      if (slugs.has(document.slug))
        throw new Error(`Duplicate slug "${document.slug}" in ${directory}`);
      slugs.add(document.slug);
    }

    const report: ImportReport = { created: [], updated: [], unchanged: [] };
    for (const document of documents) {
      const outcome = await this.upsert(document);
      report[outcome].push(document.slug);
    }
    return report;
  }

  private async upsert(document: ContentDocument): Promise<keyof ImportReport> {
    return this.db.transaction(async (tx) => {
      const existing = await tx.query.texts.findFirst({
        columns: { id: true, contentHash: true },
        where: eq(texts.slug, document.slug),
      });
      if (existing?.contentHash === document.contentHash) return 'unchanged';

      const values = {
        slug: document.slug,
        title: document.title,
        level: document.level,
        summary: document.summary,
        paragraphs: document.paragraphs,
        topics: document.topics,
        wordCount: document.wordCount,
        author: document.author,
        license: document.license,
        contentHash: document.contentHash,
      };
      let textId: string;
      if (existing) {
        await tx.update(texts).set(values).where(eq(texts.id, existing.id));
        await tx.delete(glossaryEntries).where(eq(glossaryEntries.textId, existing.id));
        textId = existing.id;
      } else {
        const [inserted] = await tx
          .insert(texts)
          .values({ ...values, publishedAt: new Date() })
          .returning({ id: texts.id });
        textId = inserted!.id;
      }
      if (document.glossary.length > 0) {
        await tx
          .insert(glossaryEntries)
          .values(document.glossary.map((entry) => ({ ...entry, textId })));
      }
      return existing ? 'updated' : 'created';
    });
  }

  private async findMarkdownFiles(directory: string): Promise<string[]> {
    const entries = await readdir(directory, { recursive: true, withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'README.md')
      .map((entry) => path.join(entry.parentPath, entry.name))
      .sort();
  }
}
