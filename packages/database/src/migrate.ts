import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDatabase } from './client.js';

export const MIGRATIONS_FOLDER = fileURLToPath(new URL('../migrations', import.meta.url));

/**
 * Applies pending migrations; already applied ones are skipped. Run it from a single
 * process (the `migrate` Compose service / a deploy step), not from every app replica.
 */
export async function runMigrations(connectionString: string): Promise<void> {
  const connection = createDatabase({
    connectionString,
    max: 1,
    applicationName: 'lingoup-migrate',
  });
  try {
    // Bookkeeping lives in the default "drizzle" schema, apart from module schemas.
    await migrate(connection.db, { migrationsFolder: MIGRATIONS_FOLDER });
  } finally {
    await connection.close();
  }
}

// pnpm links workspace packages through symlinks, so compare real paths: a plain string
// comparison silently skipped the migrations when run as node_modules/@lingoup/database/....
const isEntrypoint =
  process.argv[1] !== undefined && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
if (isEntrypoint) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }
  runMigrations(url)
    .then(() => {
      console.warn('Migrations applied');
    })
    .catch((error: unknown) => {
      console.error('Migration failed:', describeError(error));
      process.exit(1);
    });
}

/** Error text for CLI output: the root cause, without bound query parameters. */
export function describeError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const message = error.message.split('\nparams:')[0] ?? error.message;
  return error.cause === undefined ? message : `${message} (cause: ${describeError(error.cause)})`;
}
