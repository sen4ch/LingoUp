import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { IdentityService } from './application/identity.service.js';
import { SessionService } from './application/session.service.js';
import { UserSettingsQuery } from './application/user-settings.query.js';
import { AuthController } from './http/auth.controller.js';
import { MeController } from './http/me.controller.js';
import { SessionGuard } from './http/session.guard.js';
import { IdentityRepository } from './infrastructure/identity.repository.js';
import { LoginAttemptLimiter } from './infrastructure/login-attempt-limiter.js';
import { PasswordHasher } from './infrastructure/password-hasher.js';

@Module({
  controllers: [AuthController, MeController],
  providers: [
    IdentityRepository,
    PasswordHasher,
    LoginAttemptLimiter,
    IdentityService,
    SessionService,
    UserSettingsQuery,
    { provide: APP_GUARD, useClass: SessionGuard },
  ],
  exports: [UserSettingsQuery],
})
export class IdentityModule {}
