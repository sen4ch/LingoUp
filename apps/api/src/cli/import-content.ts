// Imports reading texts from content/reading into PostgreSQL. Idempotent.
// Usage: pnpm content:import   (or `node dist/cli/import-content.js` with DATABASE_URL set)
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDatabase, describeError } from '@lingoup/database';
import { ContentImporter } from '../modules/content/index.js';
import { GrammarImporter } from '../modules/grammar/index.js';

const repositoryRoot = fileURLToPath(new URL('../../../../', import.meta.url));

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  const contentRoot = path.resolve(process.env.CONTENT_DIR ?? path.join(repositoryRoot, 'content'));

  const connection = createDatabase({
    connectionString: url,
    max: 2,
    applicationName: 'lingoup-content-import',
  });
  try {
    const texts = await new ContentImporter(connection.db).importDirectory(
      path.join(contentRoot, 'reading'),
    );
    const grammar = await new GrammarImporter(connection.db).importDirectory(
      path.join(contentRoot, 'grammar'),
    );
    for (const [kind, report] of [
      ['texts', texts],
      ['grammar topics', grammar],
    ] as const) {
      console.warn(
        `Content import (${kind}) from ${contentRoot}: ${report.created.length} created, ` +
          `${report.updated.length} updated, ${report.unchanged.length} unchanged`,
      );
    }
  } finally {
    await connection.close();
  }
}

main().catch((error: unknown) => {
  console.error('Content import failed:', describeError(error));
  process.exit(1);
});
