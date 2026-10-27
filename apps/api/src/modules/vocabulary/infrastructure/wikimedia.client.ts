import type { ImageCandidate } from '@lingoup/contracts';
import { z } from 'zod';
import {
  fetchWithTimeout,
  ImageSearchError,
  readImage,
  safeUrl,
  type ImageSearchProvider,
} from './image-search.js';

const API_URL = 'https://commons.wikimedia.org/w/api.php';
const PAGE_SIZE = 12;
const IMAGE_WIDTH = 640;
/** Thumbnails are only downloaded from Wikimedia's own media hosts. */
const MEDIA_HOSTS = new Set(['upload.wikimedia.org', 'thumb.wikimedia.org']);
const RASTER_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

const MetadataValue = z.object({ value: z.unknown() }).optional();
const PageSchema = z.object({
  pageid: z.number().int().positive(),
  title: z.string(),
  index: z.number().optional(),
  imageinfo: z
    .array(
      z.object({
        thumburl: z.string().optional(),
        descriptionurl: z.string().optional(),
        mime: z.string(),
        extmetadata: z
          .object({
            LicenseShortName: MetadataValue,
            LicenseUrl: MetadataValue,
            Artist: MetadataValue,
            ObjectName: MetadataValue,
          })
          .optional(),
      }),
    )
    .min(1),
});
type Page = z.infer<typeof PageSchema>;

const ResponseSchema = z.object({
  continue: z.object({ gsroffset: z.number() }).partial().optional(),
  query: z.object({ pages: z.array(z.unknown()) }).optional(),
});

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  '#39': "'",
  nbsp: ' ',
};

/** Commons metadata is HTML ("<a href=…>User</a>"); attribution needs plain text. */
export function plainText(value: unknown, max = 200): string | null {
  if (typeof value !== 'string') return null;
  const text = value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, name: string) => ENTITIES[name]!)
    .replace(/\s+/g, ' ')
    .trim();
  return text ? text.slice(0, max) : null;
}

/** "File:Small_flat_in_Paris.jpg" → "Small flat in Paris". */
const fileName = (title: string) =>
  title
    .replace(/^File:/, '')
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/_/g, ' ');

/** Artwork templates embed hidden Wikidata statements ("QS:P1476,…"); those are not titles. */
function objectName(value: unknown): string | null {
  const text = plainText(value);
  return text && !text.includes('QS:') ? text : null;
}

export function toCandidate(page: Page): ImageCandidate {
  const info = page.imageinfo[0]!;
  const meta = info.extmetadata ?? {};
  return {
    id: String(page.pageid),
    title: objectName(meta.ObjectName?.value) ?? fileName(page.title),
    creator: plainText(meta.Artist?.value),
    license: plainText(meta.LicenseShortName?.value, 60),
    licenseUrl: safeUrl(plainText(meta.LicenseUrl?.value, 300)?.replace(/^\/\//, 'https://')),
    landingUrl: safeUrl(info.descriptionurl),
  };
}

/**
 * Wikimedia Commons: over 100 million freely licensed files, no API key. Requests carry a
 * descriptive User-Agent as Wikimedia's API policy requires. Commons has no mature-content
 * filter; only raster images are offered (no SVG).
 */
export class WikimediaClient implements ImageSearchProvider {
  readonly name = 'wikimedia';

  constructor(
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly timeoutMs = 10_000,
  ) {}

  isValidId(id: string): boolean {
    return /^[1-9][0-9]{0,11}$/.test(id);
  }

  async search(
    query: string,
    page: number,
  ): Promise<{ items: ImageCandidate[]; hasMore: boolean }> {
    const url = this.queryUrl({
      generator: 'search',
      gsrsearch: `${query} filetype:bitmap`,
      gsrnamespace: '6',
      gsrlimit: String(PAGE_SIZE),
      gsroffset: String((page - 1) * PAGE_SIZE),
    });
    const body = await this.query(url);
    const pages = this.pages(body.query?.pages ?? []).sort(
      (a, b) => (a.index ?? 0) - (b.index ?? 0),
    );
    return { items: pages.map(toCandidate), hasMore: body.continue?.gsroffset !== undefined };
  }

  async details(id: string): Promise<ImageCandidate> {
    return toCandidate(await this.page(id));
  }

  async image(id: string): Promise<Buffer> {
    const thumb = (await this.page(id)).imageinfo[0]!.thumburl;
    const url = thumb ? new URL(thumb, 'https://upload.wikimedia.org') : null;
    if (!url || url.protocol !== 'https:' || !MEDIA_HOSTS.has(url.hostname))
      throw new ImageSearchError('Unexpected Wikimedia image URL');
    return readImage(await fetchWithTimeout(this.fetchImpl, url, this.timeoutMs));
  }

  private async page(id: string): Promise<Page> {
    if (!this.isValidId(id)) throw new ImageSearchError('Invalid Wikimedia page id');
    const [page] = this.pages(
      (await this.query(this.queryUrl({ pageids: id }))).query?.pages ?? [],
    );
    if (!page) throw new ImageSearchError('Wikimedia image not found');
    return page;
  }

  private pages(raw: unknown[]): Page[] {
    return raw
      .map((page) => PageSchema.safeParse(page))
      .filter((page) => page.success && RASTER_TYPES.has(page.data.imageinfo[0]!.mime))
      .map((page) => page.data!);
  }

  private queryUrl(params: Record<string, string>): URL {
    const url = new URL(API_URL);
    const all = {
      action: 'query',
      format: 'json',
      formatversion: '2',
      prop: 'imageinfo',
      iiprop: 'url|extmetadata|mime',
      iiurlwidth: String(IMAGE_WIDTH),
      iiextmetadatafilter: 'LicenseShortName|LicenseUrl|Artist|ObjectName',
      ...params,
    };
    for (const [key, value] of Object.entries(all)) url.searchParams.set(key, value);
    return url;
  }

  private async query(url: URL) {
    const body = ResponseSchema.safeParse(
      await (await fetchWithTimeout(this.fetchImpl, url, this.timeoutMs)).json(),
    );
    if (!body.success) throw new ImageSearchError('Unexpected Wikimedia response');
    return body.data;
  }
}
