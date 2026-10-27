import type { ImageCandidate } from '@lingoup/contracts';
import { z } from 'zod';
import {
  fetchWithTimeout,
  ImageSearchError,
  readImage,
  safeUrl,
  type ImageSearchProvider,
} from './image-search.js';

const BASE_URL = 'https://api.openverse.org/v1/images/';
const PAGE_SIZE = 12;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const OpenverseImageSchema = z.object({
  id: z.uuid(),
  title: z.string().nullish(),
  creator: z.string().nullish(),
  license: z.string(),
  license_version: z.string().nullish(),
  license_url: z.string().nullish(),
  foreign_landing_url: z.string().nullish(),
});
type OpenverseImage = z.infer<typeof OpenverseImageSchema>;

const SearchResponseSchema = z.object({
  page_count: z.number(),
  results: z.array(z.unknown()),
});

/** "by-sa" + "4.0" → "CC BY-SA 4.0"; public-domain marks get their usual names. */
export function formatLicense(license: string, version: string | null | undefined): string {
  const code = license.toLowerCase();
  if (code === 'pdm') return 'Public Domain Mark';
  if (code === 'cc0') return 'CC0 1.0';
  return `CC ${code.toUpperCase()}${version ? ` ${version}` : ''}`;
}

export function toCandidate(image: OpenverseImage): ImageCandidate {
  return {
    id: image.id,
    title: image.title?.slice(0, 200) || null,
    creator: image.creator?.slice(0, 200) || null,
    license: formatLicense(image.license, image.license_version),
    licenseUrl: safeUrl(image.license_url),
    landingUrl: safeUrl(image.foreign_landing_url),
  };
}

/**
 * Openverse (openverse.org): openly licensed media from Wikimedia Commons, Flickr and other
 * sources, with a mature-content filter. Anonymous access is rate limited and the public
 * service is sometimes overloaded, so Wikimedia Commons is the default provider.
 */
export class OpenverseClient implements ImageSearchProvider {
  readonly name = 'openverse';

  constructor(
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly timeoutMs = 10_000,
  ) {}

  isValidId(id: string): boolean {
    return UUID.test(id);
  }

  async search(
    query: string,
    page: number,
  ): Promise<{ items: ImageCandidate[]; hasMore: boolean }> {
    const url = new URL(BASE_URL);
    url.searchParams.set('q', query);
    url.searchParams.set('page', String(page));
    url.searchParams.set('page_size', String(PAGE_SIZE));
    url.searchParams.set('mature', 'false');
    const body = SearchResponseSchema.safeParse(await this.json(url));
    if (!body.success) throw new ImageSearchError('Unexpected Openverse response');
    const items = body.data.results
      .map((result) => OpenverseImageSchema.safeParse(result))
      .filter((result) => result.success)
      .map((result) => toCandidate(result.data));
    return { items, hasMore: page < body.data.page_count };
  }

  async details(id: string): Promise<ImageCandidate> {
    const image = OpenverseImageSchema.safeParse(await this.json(new URL(`${id}/`, BASE_URL)));
    if (!image.success) throw new ImageSearchError('Unexpected Openverse response');
    return toCandidate(image.data);
  }

  /** Openverse's own resized copy of the image (it fetches the original for us). */
  async image(id: string): Promise<Buffer> {
    return readImage(
      await fetchWithTimeout(this.fetchImpl, new URL(`${id}/thumb/`, BASE_URL), this.timeoutMs),
    );
  }

  private async json(url: URL): Promise<unknown> {
    return (await fetchWithTimeout(this.fetchImpl, url, this.timeoutMs)).json();
  }
}
