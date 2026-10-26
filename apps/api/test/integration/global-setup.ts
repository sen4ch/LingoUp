import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDatabase } from '@lingoup/database';
import { requireTestDatabaseUrl, resetTestDatabase } from '@lingoup/database/testing';
import { ContentImporter } from '../../src/modules/content/index.js';

const contentDir = fileURLToPath(new URL('../../../../content/reading', import.meta.url));

/** Fresh database with migrations and demo content for every integration run. */
export default async function setup(): Promise<void> {
  const url = requireTestDatabaseUrl();
  await resetTestDatabase(url);
  const connection = createDatabase({ connectionString: url, max: 2 });
  try {
    await new ContentImporter(connection.db).importDirectory(path.resolve(contentDir));
  } finally {
    await connection.close();
  }
}
