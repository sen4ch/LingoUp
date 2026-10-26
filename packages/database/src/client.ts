import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema/index.js';

export type DatabaseSchema = typeof schema;
export type Database = NodePgDatabase<DatabaseSchema>;
/** Either the root database handle or an open transaction. */
export type DbExecutor = Database | Parameters<Parameters<Database['transaction']>[0]>[0];

export interface DatabaseConnection {
  db: Database;
  pool: pg.Pool;
  close(): Promise<void>;
}

export interface CreateDatabaseOptions {
  connectionString: string;
  /** Pool size per process. Keep (instances x max) below PostgreSQL max_connections. */
  max?: number;
  applicationName?: string;
  /** Server-side statement timeout, protects the database from runaway queries. */
  statementTimeoutMs?: number;
  /**
   * Called when an idle pooled connection fails (e.g. PostgreSQL restarted). The pool
   * discards the broken client and reconnects on demand; without a listener Node.js
   * would crash the process on this 'error' event.
   */
  onIdleClientError?: (error: Error) => void;
}

export function createDatabase(options: CreateDatabaseOptions): DatabaseConnection {
  const pool = new pg.Pool({
    connectionString: options.connectionString,
    max: options.max ?? 10,
    application_name: options.applicationName ?? 'lingoup',
    statement_timeout: options.statementTimeoutMs ?? 15_000,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
  pool.on(
    'error',
    options.onIdleClientError ??
      ((error) => {
        console.warn(`PostgreSQL idle connection error (will reconnect): ${error.message}`);
      }),
  );
  const db = drizzle(pool, { schema, casing: 'snake_case' });
  return {
    db,
    pool,
    close: () => pool.end(),
  };
}

/** PostgreSQL error code helpers (https://www.postgresql.org/docs/current/errcodes-appendix.html). */
export const PG_ERROR = {
  uniqueViolation: '23505',
  foreignKeyViolation: '23503',
} as const;

export function isPgError(error: unknown, code: string, constraint?: string): boolean {
  // drizzle wraps driver errors; the original pg error is in `cause`.
  const candidate = (error as { cause?: unknown } | null)?.cause ?? error;
  if (typeof candidate !== 'object' || candidate === null) return false;
  const pgError = candidate as { code?: unknown; constraint?: unknown };
  return pgError.code === code && (constraint === undefined || pgError.constraint === constraint);
}
