import pg from 'pg';
import { runMigrations } from './migrate.js';

/**
 * Drops and recreates the database named in `testDatabaseUrl`, then applies all
 * migrations. Refuses to touch a database whose name does not end with "_test".
 */
export async function resetTestDatabase(testDatabaseUrl: string): Promise<void> {
  const url = new URL(testDatabaseUrl);
  const name = decodeURIComponent(url.pathname.slice(1));
  if (!/^[a-z0-9_]+_test$/.test(name)) {
    throw new Error(
      `Refusing to reset "${name}": test database names must match /^[a-z0-9_]+_test$/`,
    );
  }
  const adminUrl = new URL(testDatabaseUrl);
  adminUrl.pathname = '/postgres';
  const admin = new pg.Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  try {
    await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await admin.query(`CREATE DATABASE "${name}"`);
  } finally {
    await admin.end();
  }
  await runMigrations(testDatabaseUrl);
}

/** Resolves the integration-test database URL or explains how to provide it. */
export function requireTestDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error(
      'TEST_DATABASE_URL is not set. Start PostgreSQL (docker compose up -d postgres) and set it in .env',
    );
  }
  return url;
}
