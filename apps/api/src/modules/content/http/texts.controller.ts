import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  ListTextsQuerySchema,
  ListTextsResponseSchema,
  SlugParamSchema,
  TextDetailSchema,
  type ListTextsQuery,
  type ListTextsResponse,
  type TextDetail,
} from '@lingoup/contracts';
import { Public, ZodParams, ZodQuery, ZodResponse } from '../../../platform/index.js';
import { ContentQuery } from '../application/content.query.js';

@ApiTags('content')
@Public()
@Controller('v1/texts')
export class TextsController {
  constructor(private readonly content: ContentQuery) {}

  @Get()
  @ZodResponse(200, ListTextsResponseSchema)
  async list(@ZodQuery(ListTextsQuerySchema) query: ListTextsQuery): Promise<ListTextsResponse> {
    return { items: await this.content.listTexts(query.level) };
  }

  @Get(':slug')
  @ZodResponse(200, TextDetailSchema)
  get(@ZodParams(SlugParamSchema) params: { slug: string }): Promise<TextDetail> {
    return this.content.getText(params.slug);
  }
}
