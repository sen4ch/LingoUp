import { Controller, Delete, Get, HttpCode, Put, Req, Res } from '@nestjs/common';
import { ApiConsumes, ApiProduces, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  ApiErrorSchema,
  ChooseWordImageRequestSchema,
  IdParamSchema,
  ImageSearchQuerySchema,
  ImageSearchResponseSchema,
  ImageIdParamSchema,
  WORD_IMAGE_UPLOAD_TYPES,
  WordImageSchema,
  type ChooseWordImageRequest,
  type ImageSearchQuery,
  type ImageSearchResponse,
  type WordImage,
} from '@lingoup/contracts';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ZodBody, ZodParams, ZodQuery, ZodResponse } from '../../../platform/index.js';
import { CurrentUser, type AuthenticatedUser } from '../../identity/index.js';
import { WordImageService, type ImageFile } from '../application/word-image.service.js';

function sendImage(reply: FastifyReply, file: ImageFile, maxAgeSeconds: number): Buffer {
  reply.header('content-type', file.mimeType);
  reply.header('cache-control', `private, max-age=${maxAgeSeconds}`);
  return file.data;
}

@ApiTags('vocabulary')
@Controller('v1/vocabulary')
export class WordImagesController {
  constructor(private readonly images: WordImageService) {}

  @Get('images/search')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ZodResponse(200, ImageSearchResponseSchema)
  @ZodResponse(503, ApiErrorSchema, 'Image search is disabled or did not answer')
  search(@ZodQuery(ImageSearchQuerySchema) query: ImageSearchQuery): Promise<ImageSearchResponse> {
    return this.images.search(query);
  }

  /** Thumbnails of search results, proxied and re-encoded by the API. */
  @Get('images/:imageId/thumb')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiProduces('image/webp')
  async thumbnail(
    @ZodParams(ImageIdParamSchema) params: { imageId: string },
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<Buffer> {
    return sendImage(reply, await this.images.thumbnail(params.imageId), 86_400);
  }

  @Get('words/:id/image')
  @ApiProduces('image/webp')
  async image(
    @CurrentUser() user: AuthenticatedUser,
    @ZodParams(IdParamSchema) params: { id: string },
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<Buffer> {
    // The URL carries ?v=<updatedAt>, so a long cache never shows a replaced picture.
    return sendImage(reply, await this.images.image(user.id, params.id), 604_800);
  }

  @Put('words/:id/image')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ZodResponse(200, WordImageSchema)
  @ZodResponse(503, ApiErrorSchema, 'Image search is disabled or did not answer')
  choose(
    @CurrentUser() user: AuthenticatedUser,
    @ZodParams(IdParamSchema) params: { id: string },
    @ZodBody(ChooseWordImageRequestSchema) body: ChooseWordImageRequest,
  ): Promise<WordImage> {
    return this.images.chooseFromSearch(user.id, params.id, body.imageId);
  }

  /** Raw image body (Content-Type: image/jpeg, png, webp or gif), at most 5 MB. */
  @Put('words/:id/image/upload')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiConsumes(...WORD_IMAGE_UPLOAD_TYPES)
  @ZodResponse(200, WordImageSchema)
  @ZodResponse(422, ApiErrorSchema, 'Not a readable JPEG, PNG, WebP or GIF image')
  upload(
    @CurrentUser() user: AuthenticatedUser,
    @ZodParams(IdParamSchema) params: { id: string },
    @Req() request: FastifyRequest,
  ): Promise<WordImage> {
    const mimeType = (request.headers['content-type'] ?? '').split(';')[0]!.trim().toLowerCase();
    const data = Buffer.isBuffer(request.body) ? request.body : Buffer.alloc(0);
    return this.images.upload(user.id, params.id, { data, mimeType });
  }

  @Delete('words/:id/image')
  @HttpCode(204)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @ZodParams(IdParamSchema) params: { id: string },
  ): Promise<void> {
    return this.images.remove(user.id, params.id);
  }
}
