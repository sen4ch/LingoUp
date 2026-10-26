import { createApp } from './bootstrap.js';
import { loadAppConfig } from './config/app-config.js';

async function main(): Promise<void> {
  const config = loadAppConfig();
  const app = await createApp(config);
  await app.listen({ host: config.http.host, port: config.http.port });
}

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection', reason);
  process.exit(1);
});

main().catch((error: unknown) => {
  console.error('API failed to start:', error instanceof Error ? error.message : error);
  process.exit(1);
});
