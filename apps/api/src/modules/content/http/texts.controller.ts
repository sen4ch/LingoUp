import { Controller, Delete, Get, HttpCode, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  ListTextsQuerySchema,
  ListTextsResponseSchema,
  MyTextsResponseSchema,
  SlugParamSchema,
  TextDetailSchema,
  type ListTextsQuery,
  type ListTextsResponse,
  type MyTextsResponse,
  type TextDetail,
} from '@lingoup/contracts';
import type { FastifyRequest } from 'fastify';
import { Public, ZodParams, ZodQuery, ZodResponse } from '../../../platform/index.js';
import { CurrentUser, type AuthenticatedUser } from '../../identity/index.js';
import { ContentQuery } from '../application/content.query.js';
import { PrivateTextsService } from '../application/private-texts.service.js';

@ApiTags('content')
@Controller('v1/texts')
export class TextsController {
  constructor(
    private readonly content: ContentQuery,
    private readonly privateTexts: PrivateTextsService,
  ) {}

  @Public()
  @Get()
  @ZodResponse(200, ListTextsResponseSchema)
  async list(@ZodQuery(ListTextsQuerySchema) query: ListTextsQuery): Promise<ListTextsResponse> {
    return { items: await this.content.listTexts(query.level) };
  }

  /** The learner's private texts (e.g. generated from their vocabulary). */
  @Get('mine')
  @ZodResponse(200, MyTextsResponseSchema)
  async mine(@CurrentUser() user: AuthenticatedUser): Promise<MyTextsResponse> {
    return { items: await this.content.listMyTexts(user.id) };
  }

  @Delete('mine/:slug')
  @HttpCode(204)
  deleteMine(
    @CurrentUser() user: AuthenticatedUser,
    @ZodParams(SlugParamSchema) params: { slug: string },
  ): Promise<void> {
    return this.privateTexts.deleteOwned(user.id, params.slug);
  }

  /** Public for library texts; a private text is readable only by its owner. */
  @Public()
  @Get(':slug')
  @ZodResponse(200, TextDetailSchema)
  get(
    @ZodParams(SlugParamSchema) params: { slug: string },
    @Req() request: FastifyRequest,
  ): Promise<TextDetail> {
    return this.content.getText(params.slug, request.user?.id ?? null);
  }
}
