import type { NextRequest } from 'next/server';
import { API_INTERNAL_URL } from '@/lib/server-api';

/**
 * Same-origin proxy to the API. Keeps the session cookie first-party (no CORS) and lets
 * the API address be configured at runtime (API_INTERNAL_URL), unlike next.config rewrites.
 */
const FORWARDED_REQUEST_HEADERS = [
  'content-type',
  'cookie',
  'origin',
  'user-agent',
  'accept',
  'x-forwarded-for',
];
const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'transfer-encoding',
  'content-encoding',
  'content-length',
]);
const TIMEOUT_MS = 30_000;
/** AI generation runs synchronously and may take minutes on a local model (AI_GENERATION_TIMEOUT_MS). */
const LONG_RUNNING_PATHS = new Set([
  'v1/learning/writing/turn',
  'v1/learning/generated-texts',
  'v1/vocabulary/practice',
  'v1/learning/speaking/transcribe',
]);
const LONG_TIMEOUT_MS = 150_000;

async function proxy(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await context.params;
  const target = `${API_INTERNAL_URL}/${path.map(encodeURIComponent).join('/')}${request.nextUrl.search}`;

  const headers = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      body: hasBody ? await request.arrayBuffer() : null,
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(
        path.join('/') === 'v1/learning/listening'
          ? 300_000
          : LONG_RUNNING_PATHS.has(path.join('/')) || path.join('/').startsWith('v1/learning/exams/')
            ? LONG_TIMEOUT_MS
            : TIMEOUT_MS,
      ),
    });
  } catch {
    return Response.json(
      { error: { code: 'INTERNAL_ERROR', message: 'API is unreachable' } },
      { status: 502 },
    );
  }

  const responseHeaders = new Headers();
  upstream.headers.forEach((value, name) => {
    if (!HOP_BY_HOP.has(name) && name !== 'set-cookie') responseHeaders.set(name, value);
  });
  for (const cookie of upstream.headers.getSetCookie())
    responseHeaders.append('set-cookie', cookie);

  return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const PUT = proxy;
export const DELETE = proxy;
