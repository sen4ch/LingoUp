// Imports reading texts from content/reading into PostgreSQL. Idempotent.
// Usage: pnpm content:import   (or `node dist/cli/import-content.js` with DATABASE_URL set)
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDatabase, describeError } from '@lingoup/database';
import { ContentImporter } from '../modules/content/index.js';

const repositoryRoot = fileURLToPath(new URL('../../../../', import.meta.url));

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  const contentDir = path.resolve(
    process.env.CONTENT_DIR ?? path.join(repositoryRoot, 'content'),
    'reading',
  );

  const connection = createDatabase({
    connectionString: url,
    max: 2,
    applicationName: 'lingoup-content-import',
  });
  try {
    const report = await new ContentImporter(connection.db).importDirectory(contentDir);
    console.warn(
      `Content import from ${contentDir}: ${report.created.length} created, ` +
        `${report.updated.length} updated, ${report.unchanged.length} unchanged`,
    );
  } finally {
    await connection.close();
  }
}

main().catch((error: unknown) => {
  console.error('Content import failed:', describeError(error));
  process.exit(1);
});
