import type { ImageCandidate } from '@lingoup/contracts';

export const IMAGE_SEARCH = Symbol('IMAGE_SEARCH');

/** A provider did not answer or answered with something unusable. */
export class ImageSearchError extends Error {}

export const MAX_SOURCE_IMAGE_BYTES = 3 * 1024 * 1024;

/**
 * Searches openly licensed pictures. Only the search phrase leaves the server; images are
 * downloaded by the API, so the learner's browser never contacts third-party hosts.
 */
export interface ImageSearchProvider {
  readonly name: 'wikimedia' | 'openverse';
  isValidId(id: string): boolean;
  search(query: string, page: number): Promise<{ items: ImageCandidate[]; hasMore: boolean }>;
  details(id: string): Promise<ImageCandidate>;
  /** A resized copy (≥ 640 px when available) for storage and thumbnails. */
  image(id: string): Promise<Buffer>;
}

/** Only http(s) links are kept: they end up in href attributes. */
export const safeUrl = (value: string | null | undefined) =>
  value && /^https?:\/\//i.test(value) ? value : null;

export const USER_AGENT = 'LingoUp/0.1 (https://github.com/sen4ch/LingoUp)';

export async function fetchWithTimeout(
  fetchImpl: typeof fetch,
  url: URL,
  timeoutMs: number,
): Promise<Response> {
  let response: Response;
  try {
    response = await fetchImpl(url, {
      headers: { 'user-agent': USER_AGENT, accept: 'application/json, image/*' },
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    throw new ImageSearchError(
      `${url.hostname} request failed: ${error instanceof Error ? error.name : 'unknown'}`,
    );
  }
  if (!response.ok) throw new ImageSearchError(`${url.hostname} responded with ${response.status}`);
  return response;
}

export async function readImage(response: Response): Promise<Buffer> {
  const type = response.headers.get('content-type') ?? '';
  if (!type.startsWith('image/')) throw new ImageSearchError(`Unexpected image type: ${type}`);
  if (Number(response.headers.get('content-length') ?? 0) > MAX_SOURCE_IMAGE_BYTES)
    throw new ImageSearchError('Image too large');
  if (!response.body) throw new ImageSearchError('Empty image response');
  const reader = (response.body as ReadableStream<Uint8Array>).getReader();
  const chunks: Buffer[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_SOURCE_IMAGE_BYTES) {
        await reader.cancel();
        throw new ImageSearchError('Image too large');
      }
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks, size);
  } catch (error) {
    if (error instanceof ImageSearchError) throw error;
    throw new ImageSearchError('Image download failed');
  } finally {
    reader.releaseLock();
  }
}
