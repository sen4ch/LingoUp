import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { NextPracticeSchema } from '@lingoup/contracts';
import { ZodResponse } from '../../../platform/index.js';
import { CurrentUser, type AuthenticatedUser } from '../../identity/index.js';
import { NextPracticeService } from '../application/next-practice.service.js';

@ApiTags('learning')
@Controller('v1/learning')
export class NextPracticeController {
  constructor(private readonly nextPractice: NextPracticeService) {}
  @Get('next-practice')
  @ZodResponse(200, NextPracticeSchema)
  next(@CurrentUser() user: AuthenticatedUser) {
    return this.nextPractice.next(user.id);
  }
}
