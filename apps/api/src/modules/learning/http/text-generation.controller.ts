import { Controller, HttpCode, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  ApiErrorSchema,
  GenerateTextRequestSchema,
  GenerateTextResponseSchema,
  type GenerateTextRequest,
  type GenerateTextResponse,
} from '@lingoup/contracts';
import { ZodBody, ZodResponse } from '../../../platform/index.js';
import { CurrentUser, type AuthenticatedUser } from '../../identity/index.js';
import { TextGenerationService } from '../application/text-generation.service.js';

@ApiTags('learning')
@Controller('v1/learning/generated-texts')
export class TextGenerationController {
  constructor(private readonly generation: TextGenerationService) {}

  /** Generates a private reading text from the learner's vocabulary (may take up to a minute). */
  @Post()
  @HttpCode(201)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ZodResponse(201, GenerateTextResponseSchema)
  @ZodResponse(422, ApiErrorSchema, 'Fewer than 3 saved words')
  @ZodResponse(
    503,
    ApiErrorSchema,
    'AI disabled, consent missing, quota exceeded or provider failure',
  )
  generate(
    @CurrentUser() user: AuthenticatedUser,
    @ZodBody(GenerateTextRequestSchema) body: GenerateTextRequest,
  ): Promise<GenerateTextResponse> {
    return this.generation.generate(user.id, body);
  }
}
