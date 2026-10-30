import { Controller, Get, Patch } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  IdParamSchema,
  MistakeEntrySchema,
  MistakeListSchema,
  MistakeQuerySchema,
  UpdateMistakeSchema,
  type MistakeQuery,
} from '@lingoup/contracts';
import { ZodBody, ZodParams, ZodQuery, ZodResponse } from '../../../platform/index.js';
import { CurrentUser, type AuthenticatedUser } from '../../identity/index.js';
import { MistakeJournal } from '../application/mistake-journal.service.js';

@ApiTags('progress')
@Controller('v1/progress/mistakes')
export class MistakesController {
  constructor(private readonly journal: MistakeJournal) {}
  @Get()
  @ZodResponse(200, MistakeListSchema)
  list(@CurrentUser() user: AuthenticatedUser, @ZodQuery(MistakeQuerySchema) query: MistakeQuery) {
    return this.journal.list(user.id, query);
  }
  @Patch(':id')
  @ZodResponse(200, MistakeEntrySchema)
  resolve(
    @CurrentUser() user: AuthenticatedUser,
    @ZodParams(IdParamSchema) params: { id: string },
    @ZodBody(UpdateMistakeSchema) body: { resolved: boolean },
  ) {
    return this.journal.resolve(user.id, params.id, body.resolved);
  }
}
