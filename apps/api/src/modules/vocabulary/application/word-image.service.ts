import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  WORD_IMAGE_MAX_UPLOAD_BYTES,
  WORD_IMAGE_UPLOAD_TYPES,
  type ImageSearchQuery,
  type ImageSearchResponse,
  type WordImage,
} from '@lingoup/contracts';
import { DomainError, notFound } from '../../../platform/index.js';
import {
  InvalidImageError,
  normalizeImage,
  PROCESSED_IMAGE_TYPE,
} from '../infrastructure/image-processing.js';
import {
  IMAGE_SEARCH,
  ImageSearchError,
  type ImageSearchProvider,
} from '../infrastructure/image-search.js';
import { VocabularyRepository } from '../infrastructure/vocabulary.repository.js';

/** Stored pictures are shown at most ~400 px wide; 640 px stays sharp on HiDPI screens. */
const STORED_SIZE = 640;
const THUMBNAIL_SIZE = 320;

export interface ImageFile {
  data: Buffer;
  mimeType: string;
}

/** A picture per word, chosen by the learner: from image search or their own upload. */
@Injectable()
export class WordImageService {
  private readonly logger = new Logger(WordImageService.name);

  constructor(
    private readonly repository: VocabularyRepository,
    @Inject(IMAGE_SEARCH) private readonly provider: ImageSearchProvider | null,
  ) {}

  async search(query: ImageSearchQuery): Promise<ImageSearchResponse> {
    const provider = this.searchProvider();
    try {
      return await provider.search(query.q, query.page);
    } catch (error) {
      throw this.searchFailed(error);
    }
  }

  async thumbnail(imageId: string): Promise<ImageFile> {
    const provider = this.searchProvider(imageId);
    try {
      const image = await normalizeImage(await provider.image(imageId), THUMBNAIL_SIZE);
      return { data: image.data, mimeType: PROCESSED_IMAGE_TYPE };
    } catch (error) {
      throw this.searchFailed(error);
    }
  }

  async chooseFromSearch(userId: string, wordId: string, imageId: string): Promise<WordImage> {
    const provider = this.searchProvider(imageId);
    await this.assertOwnWord(userId, wordId);
    let details;
    let image;
    try {
      [details, image] = await Promise.all([
        provider.details(imageId),
        provider.image(imageId).then((data) => normalizeImage(data, STORED_SIZE)),
      ]);
    } catch (error) {
      throw this.searchFailed(error);
    }
    return this.repository.upsertImage({
      wordId,
      userId,
      data: image.data,
      mimeType: PROCESSED_IMAGE_TYPE,
      width: image.width,
      height: image.height,
      source: provider.name,
      sourceId: imageId,
      title: details.title,
      creator: details.creator,
      license: details.license,
      licenseUrl: details.licenseUrl,
      landingUrl: details.landingUrl,
    });
  }

  async upload(userId: string, wordId: string, file: ImageFile): Promise<WordImage> {
    if (!(WORD_IMAGE_UPLOAD_TYPES as readonly string[]).includes(file.mimeType))
      throw new DomainError('IMAGE_INVALID', 'Upload a JPEG, PNG, WebP or GIF image');
    if (file.data.length === 0 || file.data.length > WORD_IMAGE_MAX_UPLOAD_BYTES)
      throw new DomainError('PAYLOAD_TOO_LARGE', 'The image must be at most 5 MB');
    await this.assertOwnWord(userId, wordId);
    let image;
    try {
      image = await normalizeImage(file.data, STORED_SIZE);
    } catch (error) {
      if (error instanceof InvalidImageError)
        throw new DomainError('IMAGE_INVALID', 'The file is not a readable image');
      throw error;
    }
    return this.repository.upsertImage({
      wordId,
      userId,
      data: image.data,
      mimeType: PROCESSED_IMAGE_TYPE,
      width: image.width,
      height: image.height,
      source: 'upload',
      sourceId: null,
      title: null,
      creator: null,
      license: null,
      licenseUrl: null,
      landingUrl: null,
    });
  }

  async image(userId: string, wordId: string): Promise<ImageFile> {
    const row = await this.repository.findImageData(userId, wordId);
    if (!row) throw notFound('Image');
    return { data: row.data, mimeType: row.mimeType };
  }

  async remove(userId: string, wordId: string): Promise<void> {
    if (!(await this.repository.deleteImage(userId, wordId))) throw notFound('Image');
  }

  private searchProvider(imageId?: string): ImageSearchProvider {
    if (!this.provider)
      throw new DomainError(
        'IMAGE_SEARCH_UNAVAILABLE',
        'Image search is not enabled on this server',
      );
    if (imageId !== undefined && !this.provider.isValidId(imageId)) throw notFound('Image');
    return this.provider;
  }

  private async assertOwnWord(userId: string, wordId: string): Promise<void> {
    if (!(await this.repository.findWord(userId, wordId))) throw notFound('Word');
  }

  private searchFailed(error: unknown): Error {
    if (error instanceof ImageSearchError || error instanceof InvalidImageError) {
      this.logger.warn(
        { provider: this.provider?.name, reason: error.message },
        'Image search failed',
      );
      return new DomainError(
        'IMAGE_SEARCH_UNAVAILABLE',
        'Image search did not answer, try again later',
      );
    }
    return error instanceof Error ? error : new Error('Image search failed');
  }
}
