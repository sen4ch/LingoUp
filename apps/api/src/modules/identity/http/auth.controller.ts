import { Controller, HttpCode, Inject, Post, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  ApiErrorSchema,
  CurrentUserSchema,
  LoginRequestSchema,
  RegisterRequestSchema,
  type CurrentUser as CurrentUserDto,
  type LoginRequest,
  type RegisterRequest,
} from '@lingoup/contracts';
import type { FastifyReply } from 'fastify';
import type { AppConfig } from '../../../config/app-config.js';
import { APP_CONFIG, Public, ZodBody, ZodResponse } from '../../../platform/index.js';
import { IdentityService } from '../application/identity.service.js';
import { SessionService } from '../application/session.service.js';
import type { AuthenticatedUser } from '../domain/authenticated-user.js';
import { SESSION_COOKIE } from '../domain/session-token.js';
import { CurrentUser } from './current-user.decorator.js';

// Brute-force protection: 10 attempts per minute per client IP.
const AUTH_THROTTLE = { default: { limit: 10, ttl: 60_000 } };

@ApiTags('auth')
@Controller('v1/auth')
export class AuthController {
  constructor(
    private readonly identity: IdentityService,
    private readonly sessions: SessionService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('register')
  @HttpCode(201)
  @ZodResponse(201, CurrentUserSchema, 'Registered and signed in')
  @ZodResponse(409, ApiErrorSchema, 'Email already registered')
  async register(
    @ZodBody(RegisterRequestSchema) body: RegisterRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<CurrentUserDto> {
    const { userId } = await this.identity.register(body);
    await this.startSession(userId, reply);
    return this.identity.getCurrentUser(userId);
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('login')
  @HttpCode(200)
  @ZodResponse(200, CurrentUserSchema, 'Signed in')
  @ZodResponse(401, ApiErrorSchema, 'Invalid email or password')
  async login(
    @ZodBody(LoginRequestSchema) body: LoginRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<CurrentUserDto> {
    const { userId } = await this.identity.verifyCredentials(body);
    await this.startSession(userId, reply);
    return this.identity.getCurrentUser(userId);
  }

  @Post('logout')
  @HttpCode(204)
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<void> {
    await this.sessions.revoke(user.sessionId);
    void reply.clearCookie(SESSION_COOKIE, { path: '/' });
  }

  private async startSession(userId: string, reply: FastifyReply): Promise<void> {
    const { token, expiresAt } = await this.sessions.create(userId);
    void reply.setCookie(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: this.config.session.cookieSecure,
      sameSite: 'lax',
      path: '/',
      expires: expiresAt,
    });
  }
}
