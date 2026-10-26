/**
 * Pino redact paths shared by every Node process. Personal data and credentials
 * must never reach logs; request bodies are not logged at all.
 */
export const LOG_REDACT_PATHS: readonly string[] = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-ai-service-token"]',
  'res.headers["set-cookie"]',
  '*.password',
  '*.passwordHash',
  '*.email',
  '*.token',
];
