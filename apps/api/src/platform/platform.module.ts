import {
  Global,
  Inject,
  Logger,
  Module,
  type DynamicModule,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { createDatabase, type DatabaseConnection } from '@lingoup/database';
import { Redis } from 'ioredis';
import type { AppConfig } from '../config/app-config.js';
import { HealthController } from './health/health.controller.js';
import { OutboxWriter } from './outbox/outbox-writer.js';
import { PersonalDataRegistry } from './privacy/personal-data-registry.js';
import { APP_CONFIG, DATABASE, VALKEY } from './tokens.js';

const DATABASE_CONNECTION = Symbol('DATABASE_CONNECTION');

/** Shared infrastructure: configuration, PostgreSQL, Valkey, outbox, privacy registry, health. */
@Global()
@Module({})
export class PlatformModule implements OnApplicationShutdown {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly connection: DatabaseConnection,
    @Inject(VALKEY) private readonly valkey: Redis,
  ) {}

  static register(config: AppConfig): DynamicModule {
    return {
      module: PlatformModule,
      controllers: [HealthController],
      providers: [
        { provide: APP_CONFIG, useValue: config },
        {
          provide: DATABASE_CONNECTION,
          useFactory: () =>
            createDatabase({
              connectionString: config.database.url,
              max: config.database.poolMax,
              applicationName: 'lingoup-api',
              onIdleClientError: (error) => {
                new Logger('Database').warn(
                  { err: error },
                  'Idle connection error; reconnecting on demand',
                );
              },
            }),
        },
        {
          provide: DATABASE,
          inject: [DATABASE_CONNECTION],
          useFactory: (connection: DatabaseConnection) => connection.db,
        },
        {
          provide: VALKEY,
          useFactory: () =>
            new Redis(config.valkey.url, {
              lazyConnect: true,
              maxRetriesPerRequest: 2,
              enableOfflineQueue: true,
            }),
        },
        OutboxWriter,
        PersonalDataRegistry,
      ],
      exports: [APP_CONFIG, DATABASE, VALKEY, OutboxWriter, PersonalDataRegistry],
    };
  }

  async onApplicationShutdown(): Promise<void> {
    await Promise.allSettled([this.connection.close(), this.valkey.quit()]);
  }
}
