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
export async function serverApi<T>(
  path: string,
  schema: z.ZodType<T>,
  /** Forward the visitor's session so the API can return private or per-user data. */
  { withSession = false }: { withSession?: boolean } = {},
): Promise<T> {
  const incoming = await headers();
  const forwarded: Record<string, string> = {};
  const forwardedFor = incoming.get('x-forwarded-for');
  if (forwardedFor) forwarded['x-forwarded-for'] = forwardedFor;
  const cookie = withSession ? incoming.get('cookie') : null;
  if (cookie) forwarded.cookie = cookie;
  const response = await fetch(`${API_INTERNAL_URL}${path}`, {
    cache: 'no-store',
    headers: forwarded,
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new ServerApiError(response.status);
  return schema.parse(await response.json());
}

export { API_INTERNAL_URL };
