import { Controller, Delete, Get, HttpCode, Patch, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  CurrentUserSchema,
  DeleteAccountRequestSchema,
  PersonalDataExportSchema,
  UpdateSettingsRequestSchema,
  UserSettingsSchema,
  type CurrentUser as CurrentUserDto,
  type DeleteAccountRequest,
  type PersonalDataExport,
  type UpdateSettingsRequest,
  type UserSettings,
} from '@lingoup/contracts';
import type { FastifyReply } from 'fastify';
import { PersonalDataRegistry, ZodBody, ZodResponse } from '../../../platform/index.js';
import { IdentityService } from '../application/identity.service.js';
import type { AuthenticatedUser } from '../domain/authenticated-user.js';
import { SESSION_COOKIE } from '../domain/session-token.js';
import { CurrentUser } from './current-user.decorator.js';

@ApiTags('me')
@Controller('v1/me')
export class MeController {
  constructor(
    private readonly identity: IdentityService,
    private readonly personalData: PersonalDataRegistry,
  ) {}

  @Get()
  @ZodResponse(200, CurrentUserSchema)
  me(@CurrentUser() user: AuthenticatedUser): Promise<CurrentUserDto> {
    return this.identity.getCurrentUser(user.id);
  }

  @Patch('settings')
  @ZodResponse(200, UserSettingsSchema)
  updateSettings(
    @CurrentUser() user: AuthenticatedUser,
    @ZodBody(UpdateSettingsRequestSchema) body: UpdateSettingsRequest,
  ): Promise<UserSettings> {
    return this.identity.updateSettings(user.id, body);
  }

  /** Machine-readable export of all personal data held by every module. */
  @Get('export')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ZodResponse(200, PersonalDataExportSchema)
  async exportData(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<PersonalDataExport> {
    void reply.header('content-disposition', 'attachment; filename="lingoup-export.json"');
    return {
      exportedAt: new Date().toISOString(),
      sections: await this.personalData.exportAll(user.id),
    };
  }

  /** Irreversibly deletes the account and all personal data. Requires the password. */
  @Delete()
  @HttpCode(204)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async deleteAccount(
    @CurrentUser() user: AuthenticatedUser,
    @ZodBody(DeleteAccountRequestSchema) body: DeleteAccountRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<void> {
    await this.identity.deleteAccount(user.id, body.password);
    void reply.clearCookie(SESSION_COOKIE, { path: '/' });
  }
}
