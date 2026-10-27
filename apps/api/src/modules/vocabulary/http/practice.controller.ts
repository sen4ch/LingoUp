import { Controller, HttpCode, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  ApiErrorSchema,
  CompletePracticeRequestSchema,
  PracticeSetSchema,
  type CompletePracticeRequest,
  type PracticeSet,
} from '@lingoup/contracts';
import { ZodBody, ZodResponse } from '../../../platform/index.js';
import { CurrentUser, type AuthenticatedUser } from '../../identity/index.js';
import { PracticeService } from '../application/practice.service.js';

@ApiTags('vocabulary')
@Controller('v1/vocabulary/practice')
export class PracticeController {
  constructor(private readonly practice: PracticeService) {}

  /** May call the AI gateway for sentence generation, hence the tighter limit. */
  @Post()
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ZodResponse(200, PracticeSetSchema)
  @ZodResponse(422, ApiErrorSchema, 'Fewer than 3 saved words')
  create(@CurrentUser() user: AuthenticatedUser): Promise<PracticeSet> {
    return this.practice.createSet(user.id);
  }

  @Post('complete')
  @HttpCode(204)
  complete(
    @CurrentUser() user: AuthenticatedUser,
    @ZodBody(CompletePracticeRequestSchema) body: CompletePracticeRequest,
  ): Promise<void> {
    return this.practice.complete(user.id, body);
  }
}
