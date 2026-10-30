import { Controller, Get, Post, HttpCode } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  ProgressSummarySchema,
  LearningDevelopmentSchema,
  type ProgressSummary,
  FocusTimeBatchSchema,
  FocusTimeAckSchema,
  WeeklyQuerySchema,
  WeeklyReportSchema,
  type FocusTimeBatch,
} from '@lingoup/contracts';
import { ZodBody, ZodQuery, ZodResponse } from '../../../platform/index.js';
import { CurrentUser, type AuthenticatedUser } from '../../identity/index.js';
import { ProgressService } from '../application/progress.service.js';
import { WeeklyReportService } from '../application/weekly-report.service.js';

@ApiTags('progress')
@Controller('v1/progress')
export class ProgressController {
  constructor(
    private readonly progress: ProgressService,
    private readonly weekly: WeeklyReportService,
  ) {}

  @Get('weekly')
  @ZodResponse(200, WeeklyReportSchema)
  week(
    @CurrentUser() user: AuthenticatedUser,
    @ZodQuery(WeeklyQuerySchema) query: { offset: number },
  ) {
    return this.weekly.report(user.id, query.offset);
  }

  @Post('focus-time')
  @HttpCode(200)
  @ZodResponse(200, FocusTimeAckSchema)
  focus(
    @CurrentUser() user: AuthenticatedUser,
    @ZodBody(FocusTimeBatchSchema) body: FocusTimeBatch,
  ) {
    return this.weekly.record(user.id, body);
  }

  @Get('development')
  @ZodResponse(200, LearningDevelopmentSchema)
  development(@CurrentUser() user: AuthenticatedUser) {
    return this.progress.development(user.id);
  }

  @Get('summary')
  @ZodResponse(200, ProgressSummarySchema)
  summary(@CurrentUser() user: AuthenticatedUser): Promise<ProgressSummary> {
    return this.progress.summary(user.id);
  }
}
