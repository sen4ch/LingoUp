import { randomInt, randomUUID } from 'node:crypto';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createDatabase, type DatabaseConnection } from '@lingoup/database';
import { requireTestDatabaseUrl } from '@lingoup/database/testing';
import { createApp } from '../../src/bootstrap.js';
import { loadAppConfig } from '../../src/config/app-config.js';

export const WEB_ORIGIN = 'http://localhost:3000';

export interface TestContext {
  app: NestFastifyApplication;
  /** Direct database access for assertions on persisted state. */
  database: DatabaseConnection;
  close(): Promise<void>;
}

export async function createTestContext(
  overrides: Record<string, string> = {},
): Promise<TestContext> {
  const databaseUrl = requireTestDatabaseUrl();
  const valkeyUrl = new URL(process.env.VALKEY_URL ?? 'redis://localhost:6379');
  valkeyUrl.pathname = '/15'; // Keep test rate-limit and quota keys away from dev data.
  const config = loadAppConfig({
    ...process.env,
    DATABASE_URL: databaseUrl,
    VALKEY_URL: valkeyUrl.toString(),
    LOG_LEVEL: 'silent',
    SWAGGER_ENABLED: 'false',
    AI_PROVIDER: 'mock',
    ALLOWED_ORIGINS: WEB_ORIGIN,
    ...overrides,
  });
  const app = await createApp(config);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  const database = createDatabase({ connectionString: databaseUrl, max: 2 });
  return {
    app,
    database,
    close: async () => {
      await app.close();
      await database.close();
    },
  };
}

export interface TestResponse<T = unknown> {
  status: number;
  body: T;
  headers: Record<string, unknown>;
}

/** A browser-like client: keeps the session cookie and its own IP (separate rate limits). */
export class TestAgent {
  private cookie = '';
  constructor(
    private readonly app: NestFastifyApplication,
    readonly ip = `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`,
  ) {}

  async request<T = any>(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    url: string,
    body?: unknown,
    headers: Record<string, string> = {},
  ): Promise<TestResponse<T>> {
    const response = await this.app
      .getHttpAdapter()
      .getInstance()
      .inject({
        method,
        url,
        remoteAddress: this.ip,
        headers: {
          origin: WEB_ORIGIN,
          ...(this.cookie ? { cookie: this.cookie } : {}),
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
          ...headers,
        },
        ...(body === undefined ? {} : { payload: JSON.stringify(body) }),
      });
    const setCookie = response.headers['set-cookie'];
    const first = Array.isArray(setCookie) ? setCookie[0] : setCookie;
    if (first) this.cookie = first.split(';')[0]!.includes('=;') ? '' : first.split(';')[0]!;
    return {
      status: response.statusCode,
      body: (response.body ? JSON.parse(response.body) : null) as T,
      headers: response.headers,
    };
  }

  async register(): Promise<{ id: string; email: string; password: string }> {
    const email = `user-${randomUUID()}@example.test`;
    const password = 'integration-test-password';
    const response = await this.request('POST', '/v1/auth/register', {
      email,
      password,
      displayName: 'Tester',
    });
    if (response.status !== 201)
      throw new Error(`register failed: ${response.status} ${JSON.stringify(response.body)}`);
    return { id: (response.body as { id: string }).id, email, password };
  }
}
