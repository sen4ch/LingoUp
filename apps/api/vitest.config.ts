import { existsSync } from 'node:fs';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// Integration tests talk to real PostgreSQL and Valkey configured in the root .env.
if (existsSync('../../.env')) process.loadEnvFile('../../.env');

// esbuild (Vitest's default transformer) does not emit decorator metadata, which NestJS
// dependency injection relies on, so the API is compiled with SWC in tests.
const swcPlugin = swc.vite({
  jsc: {
    parser: { syntax: 'typescript', decorators: true },
    transform: { legacyDecorator: true, decoratorMetadata: true },
    target: 'es2023',
  },
});

export default defineConfig({
  plugins: [swcPlugin],
  test: {
    projects: [
      {
        // Inline projects inherit plugins (SWC) from this file.
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts', 'test/architecture.test.ts'],
        },
      },
      {
        test: {
          name: 'integration',
          include: ['test/integration/**/*.test.ts'],
          globalSetup: ['test/integration/global-setup.ts'],
          // Tests share one database; run files sequentially.
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
