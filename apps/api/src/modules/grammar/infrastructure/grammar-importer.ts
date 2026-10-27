import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Database } from '@lingoup/database';
import { exercises, topics } from '@lingoup/database/schema/grammar';
import { eq } from 'drizzle-orm';
import { parseGrammarDocument, type GrammarDocument } from '../domain/grammar-document.js';

export interface GrammarImportReport {
  created: string[];
  updated: string[];
  unchanged: string[];
}

/**
 * Imports grammar topics from `content/grammar/**.md`. Idempotent like the text importer.
 * A changed topic replaces its exercises, which also removes the learners' attempts on the
 * old exercises (they no longer match the new prompts).
 */
export class GrammarImporter {
  constructor(private readonly db: Database) {}

  async importDirectory(directory: string): Promise<GrammarImportReport> {
    const entries = await readdir(directory, { recursive: true, withFileTypes: true });
    const files = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'README.md')
      .map((entry) => path.join(entry.parentPath, entry.name))
      .sort();
    const documents: GrammarDocument[] = [];
    for (const file of files) {
      documents.push(
        parseGrammarDocument(await readFile(file, 'utf8'), path.relative(directory, file)),
      );
    }
    const slugs = new Set<string>();
    for (const document of documents) {
      if (slugs.has(document.slug)) throw new Error(`Duplicate grammar slug "${document.slug}"`);
      slugs.add(document.slug);
    }
    const report: GrammarImportReport = { created: [], updated: [], unchanged: [] };
    for (const document of documents) report[await this.upsert(document)].push(document.slug);
    return report;
  }

  private upsert(document: GrammarDocument): Promise<keyof GrammarImportReport> {
    return this.db.transaction(async (tx) => {
      const existing = await tx.query.topics.findFirst({
        columns: { id: true, contentHash: true },
        where: eq(topics.slug, document.slug),
      });
      if (existing?.contentHash === document.contentHash) return 'unchanged';
      const values = {
        slug: document.slug,
        title: document.title,
        level: document.level,
        summary: document.summary,
        blocks: document.blocks,
        author: document.author,
        license: document.license,
        provenance: document.provenance,
        contentHash: document.contentHash,
      };
      let topicId: string;
      if (existing) {
        await tx.update(topics).set(values).where(eq(topics.id, existing.id));
        await tx.delete(exercises).where(eq(exercises.topicId, existing.id));
        topicId = existing.id;
      } else {
        const [row] = await tx
          .insert(topics)
          .values({ ...values, publishedAt: new Date() })
          .returning({ id: topics.id });
        topicId = row!.id;
      }
      await tx
        .insert(exercises)
        .values(
          document.exercises.map((exercise, position) => ({ ...exercise, topicId, position })),
        );
      return existing ? 'updated' : 'created';
    });
  }
}
