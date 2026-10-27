import sharp from 'sharp';
import { describe, expect, it, vi } from 'vitest';
import { InvalidImageError, normalizeImage } from './image-processing.js';
import { ImageSearchError, MAX_SOURCE_IMAGE_BYTES, readImage } from './image-search.js';
import { formatLicense, OpenverseClient, toCandidate } from './openverse.client.js';
import {
  plainText,
  toCandidate as wikimediaCandidate,
  WikimediaClient,
} from './wikimedia.client.js';

const ID = '4bc43a04-ef46-4544-a0c1-63c63f56e276';

async function photo(width: number, height: number, withGps = false): Promise<Buffer> {
  const image = sharp({
    create: { width, height, channels: 3, background: { r: 200, g: 120, b: 40 } },
  }).jpeg();
  return (
    withGps
      ? image.withExif({ IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '55/1 45/1 0/1' } })
      : image
  ).toBuffer();
}

describe('normalizeImage', () => {
  it('re-encodes to a WebP that fits the box and drops metadata', async () => {
    const result = await normalizeImage(await photo(2000, 1000, true), 640);
    const meta = await sharp(result.data).metadata();
    expect(meta.format).toBe('webp');
    expect([result.width, result.height]).toEqual([640, 320]);
    expect(meta.exif).toBeUndefined();
  });

  it('does not enlarge small pictures', async () => {
    const result = await normalizeImage(await photo(100, 80), 640);
    expect([result.width, result.height]).toEqual([100, 80]);
  });

  it('rejects files that are not images', async () => {
    await expect(normalizeImage(Buffer.from('<svg onload=alert(1)>'), 640)).rejects.toThrow(
      InvalidImageError,
    );
  });

  it('rejects a valid SVG disguised as an accepted upload type', async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>',
    );
    await expect(normalizeImage(svg, 640)).rejects.toThrow(InvalidImageError);
  });
});

describe('image download limits', () => {
  it('stops reading an oversized stream without a Content-Length header', async () => {
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new Uint8Array(MAX_SOURCE_IMAGE_BYTES / 2));
      },
      cancel,
    });
    await expect(
      readImage(new Response(body, { headers: { 'content-type': 'image/png' } })),
    ).rejects.toThrow('Image too large');
    expect(cancel).toHaveBeenCalledOnce();
  });
});

describe('Openverse', () => {
  it('formats licenses for the attribution line', () => {
    expect(formatLicense('by-sa', '4.0')).toBe('CC BY-SA 4.0');
    expect(formatLicense('cc0', '1.0')).toBe('CC0 1.0');
    expect(formatLicense('pdm', '')).toBe('Public Domain Mark');
  });

  it('keeps only http(s) links, which end up in href attributes', () => {
    const candidate = toCandidate({
      id: ID,
      title: 'Small flat',
      creator: 'Jane',
      license: 'by',
      license_version: '2.0',
      license_url: 'javascript:alert(1)',
      foreign_landing_url: 'https://www.flickr.com/photos/1',
    });
    expect(candidate).toEqual({
      id: ID,
      title: 'Small flat',
      creator: 'Jane',
      license: 'CC BY 2.0',
      licenseUrl: null,
      landingUrl: 'https://www.flickr.com/photos/1',
    });
  });

  it('searches without mature content and skips malformed results', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      Response.json({
        page_count: 3,
        results: [
          { id: ID, title: 'Flat', creator: null, license: 'by', license_version: '4.0' },
          { id: 'bad' },
        ],
      }),
    );
    const client = new OpenverseClient(fetchImpl);
    await expect(client.search('small flat', 1)).resolves.toMatchObject({
      hasMore: true,
      items: [{ id: ID, title: 'Flat', license: 'CC BY 4.0' }],
    });
    const url = new URL(String(fetchImpl.mock.calls[0]![0]));
    expect(url.hostname).toBe('api.openverse.org');
    expect(url.searchParams.get('q')).toBe('small flat');
    expect(url.searchParams.get('mature')).toBe('false');
  });

  it('reports errors and non-image thumbnails', async () => {
    const limited = new OpenverseClient(
      vi.fn().mockResolvedValue(new Response('', { status: 429 })),
    );
    await expect(limited.search('flat', 1)).rejects.toThrow(ImageSearchError);
    const html = new OpenverseClient(
      vi
        .fn()
        .mockResolvedValue(new Response('<html>', { headers: { 'content-type': 'text/html' } })),
    );
    await expect(html.image(ID)).rejects.toThrow(ImageSearchError);
  });
});

const commonsPage = (pageid: number, mime: string, thumburl: string, index = 1) => ({
  pageid,
  index,
  title: 'File:Small flat in Paris.jpg',
  imageinfo: [
    {
      mime,
      thumburl,
      descriptionurl: 'https://commons.wikimedia.org/wiki/File:Small_flat_in_Paris.jpg',
      extmetadata: {
        LicenseShortName: { value: 'CC BY-SA 4.0' },
        LicenseUrl: { value: '//creativecommons.org/licenses/by-sa/4.0' },
        Artist: { value: '<a href="//commons.wikimedia.org/wiki/User:Jane">Jane &amp; Co</a>' },
      },
    },
  ],
});

describe('Wikimedia Commons', () => {
  it('turns HTML metadata into plain attribution text', () => {
    expect(plainText('<bdi><a href="x">Henri</a></bdi> &amp; <i>others</i>')).toBe(
      'Henri & others',
    );
    expect(plainText(42)).toBeNull();
  });

  it('ignores artwork titles made of hidden Wikidata statements', () => {
    const page = commonsPage(9, 'image/jpeg', 'https://upload.wikimedia.org/a.jpg');
    page.imageinfo[0]!.extmetadata = {
      ...page.imageinfo[0]!.extmetadata,
      ObjectName: {
        value: 'Interior <span style="display:none">title QS:P1476,en:"Interior"</span>',
      },
    } as never;
    expect(wikimediaCandidate(page).title).toBe('Small flat in Paris');
  });

  it('searches raster images only and reads attribution', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      Response.json({
        continue: { gsroffset: 12 },
        query: {
          pages: [
            commonsPage(2, 'image/jpeg', 'https://upload.wikimedia.org/a.jpg', 2),
            commonsPage(3, 'image/svg+xml', 'https://upload.wikimedia.org/b.png', 1),
          ],
        },
      }),
    );
    const result = await new WikimediaClient(fetchImpl).search('flat', 1);
    expect(result).toEqual({
      hasMore: true,
      items: [
        {
          id: '2',
          title: 'Small flat in Paris',
          creator: 'Jane & Co',
          license: 'CC BY-SA 4.0',
          licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
          landingUrl: 'https://commons.wikimedia.org/wiki/File:Small_flat_in_Paris.jpg',
        },
      ],
    });
    const url = new URL(String(fetchImpl.mock.calls[0]![0]));
    expect(url.searchParams.get('gsrsearch')).toBe('flat filetype:bitmap');
    expect(fetchImpl.mock.calls[0]![1].headers['user-agent']).toMatch(/LingoUp/);
  });

  it('downloads images only from Wikimedia media hosts', async () => {
    const answer = (thumb: string) =>
      vi
        .fn()
        .mockResolvedValueOnce(
          Response.json({ query: { pages: [commonsPage(5, 'image/jpeg', thumb)] } }),
        )
        .mockResolvedValueOnce(
          new Response(Buffer.from('jpeg'), { headers: { 'content-type': 'image/jpeg' } }),
        );
    await expect(
      new WikimediaClient(answer('https://upload.wikimedia.org/x.jpg')).image('5'),
    ).resolves.toEqual(Buffer.from('jpeg'));
    await expect(
      new WikimediaClient(answer('https://evil.example/x.jpg')).image('5'),
    ).rejects.toThrow(ImageSearchError);
    expect(new WikimediaClient().isValidId('../etc')).toBe(false);
  });
});
