import sharp from 'sharp';

export const PROCESSED_IMAGE_TYPE = 'image/webp';

export class InvalidImageError extends Error {}

export interface ProcessedImage {
  data: Buffer;
  width: number;
  height: number;
}

/**
 * Decodes and re-encodes any picture before it is stored or served: the output is always a
 * small WebP without metadata (EXIF, GPS), so uploads cannot carry scripts, trackers or
 * oversized files, and every browser shows them the same way.
 */
export async function normalizeImage(input: Buffer, maxSize: number): Promise<ProcessedImage> {
  try {
    const image = sharp(input, {
      // Rejects decompression bombs: 40 megapixels is far above any real photo upload.
      limitInputPixels: 40_000_000,
      animated: false,
      failOn: 'error',
    });
    const metadata = await image.metadata();
    if (!['jpeg', 'png', 'webp', 'gif'].includes(metadata.format))
      throw new InvalidImageError('Unsupported image format');
    const { data, info } = await image
      .rotate() // honour EXIF orientation before the metadata is dropped
      .resize(maxSize, maxSize, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 78 })
      .toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.height };
  } catch (error) {
    throw new InvalidImageError(
      `Unreadable image: ${error instanceof Error ? error.message.slice(0, 100) : 'unknown'}`,
    );
  }
}
