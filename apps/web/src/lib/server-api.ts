import 'server-only';
import { headers } from 'next/headers';
import type { z } from 'zod';

const API_INTERNAL_URL = (process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:4000').replace(
  /\/+$/,
  '',
);

export class ServerApiError extends Error {
  constructor(public readonly status: number) {
    super(`API responded with ${status}`);
  }
}

/**
 * Server Components: fetch public data directly from the API (never cached, content is small).
 * The visitor's address is forwarded so per-IP rate limits apply to the visitor, not to the
 * web server shared by everyone.
 */
export async function serverApi<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  const forwardedFor = (await headers()).get('x-forwarded-for');
  const response = await fetch(`${API_INTERNAL_URL}${path}`, {
    cache: 'no-store',
    headers: forwardedFor ? { 'x-forwarded-for': forwardedFor } : {},
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new ServerApiError(response.status);
  return schema.parse(await response.json());
}

export { API_INTERNAL_URL };
