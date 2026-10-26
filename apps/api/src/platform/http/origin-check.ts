import type { ApiError } from '@lingoup/contracts';
import type { FastifyInstance } from 'fastify';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF defence in depth on top of SameSite=Lax cookies: browsers always send `Origin`
 * on cross-site state-changing requests, so any foreign origin is rejected. Requests
 * without `Origin` (server-to-server, curl) carry no ambient browser credentials.
 */
export function registerOriginCheck(app: FastifyInstance, allowedOrigins: readonly string[]): void {
  const allowed = new Set(allowedOrigins);
  app.addHook('onRequest', async (request, reply) => {
    if (SAFE_METHODS.has(request.method)) return;
    const origin = request.headers.origin;
    if (origin === undefined || allowed.has(origin)) return;
    const body: ApiError = {
      error: { code: 'FORBIDDEN', message: 'Origin not allowed', requestId: request.id },
    };
    await reply.status(403).send(body);
  });
}
