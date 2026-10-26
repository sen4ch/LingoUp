import { Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  DueReviewsQuerySchema,
  DueReviewsResponseSchema,
  SubmitReviewRequestSchema,
  SubmitReviewResponseSchema,
  type DueReviewsQuery,
  type DueReviewsResponse,
  type SubmitReviewRequest,
  type SubmitReviewResponse,
} from '@lingoup/contracts';
import { ZodBody, ZodQuery, ZodResponse } from '../../../platform/index.js';
import { CurrentUser, type AuthenticatedUser } from '../../identity/index.js';
import { ReviewService } from '../application/review.service.js';

@ApiTags('vocabulary')
@Controller('v1/vocabulary/reviews')
export class ReviewsController {
  constructor(private readonly reviews: ReviewService) {}

  @Get('due')
  @ZodResponse(200, DueReviewsResponseSchema)
  due(
    @CurrentUser() user: AuthenticatedUser,
    @ZodQuery(DueReviewsQuerySchema) query: DueReviewsQuery,
  ): Promise<DueReviewsResponse> {
    return this.reviews.dueCards(user.id, query.limit);
  }

  @Post()
  @HttpCode(200)
  @ZodResponse(
    200,
    SubmitReviewResponseSchema,
    'Review applied, or the original result for a repeated clientReviewId',
  )
  submit(
    @CurrentUser() user: AuthenticatedUser,
    @ZodBody(SubmitReviewRequestSchema) body: SubmitReviewRequest,
  ): Promise<SubmitReviewResponse> {
    return this.reviews.submit(user.id, body);
  }
}
