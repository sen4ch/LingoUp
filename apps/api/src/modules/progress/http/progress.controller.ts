import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ProgressSummarySchema, type ProgressSummary } from '@lingoup/contracts';
import { ZodResponse } from '../../../platform/index.js';
import { CurrentUser, type AuthenticatedUser } from '../../identity/index.js';
import { ProgressService } from '../application/progress.service.js';

@ApiTags('progress')
@Controller('v1/progress')
export class ProgressController {
  constructor(private readonly progress: ProgressService) {}

  @Get('summary')
  @ZodResponse(200, ProgressSummarySchema)
  summary(@CurrentUser() user: AuthenticatedUser): Promise<ProgressSummary> {
    return this.progress.summary(user.id);
  }
}
