// Writes the OpenAPI document to docs/api/openapi.json without serving requests.
// Connections to PostgreSQL and Valkey are lazy, so they are not required to be running.
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { buildOpenApiDocument, createApp } from '../bootstrap.js';
import { loadAppConfig } from '../config/app-config.js';

const output = fileURLToPath(new URL('../../../../docs/api/openapi.json', import.meta.url));

async function main(): Promise<void> {
  const config = loadAppConfig({
    DATABASE_URL: 'postgres://unused:unused@127.0.0.1:1/unused',
    VALKEY_URL: 'redis://127.0.0.1:1',
    ...process.env,
    LOG_LEVEL: 'silent',
    SWAGGER_ENABLED: 'false',
    AI_PROVIDER: 'mock',
  });
  const app = await createApp(config);
  await app.init();
  const document = buildOpenApiDocument(app);
  await writeFile(output, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
  await app.close();
  console.warn(`OpenAPI document written to ${output}`);
}

main().catch((error: unknown) => {
  console.error('OpenAPI export failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
