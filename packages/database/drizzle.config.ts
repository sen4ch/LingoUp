import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/*.ts',
  out: './migrations',
  casing: 'snake_case',
  schemaFilter: [
    'identity',
    'content',
    'vocabulary',
    'learning',
    'grammar',
    'progress',
    'platform',
  ],
  strict: true,
  verbose: true,
});
