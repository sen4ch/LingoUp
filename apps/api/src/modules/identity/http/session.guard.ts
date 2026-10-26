import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { DomainError, IS_PUBLIC } from '../../../platform/index.js';
import { SessionService } from '../application/session.service.js';
import '../domain/authenticated-user.js';
import { SESSION_COOKIE } from '../domain/session-token.js';

/**
 * Global guard: every route requires a valid session unless marked @Public().
 * On public routes a valid session is still attached, so they can personalize responses.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    const token = request.cookies[SESSION_COOKIE];
    const user = token ? await this.sessions.resolve(token) : null;
    if (user) request.user = user;
    if (isPublic === true || user) return true;
    throw new DomainError('UNAUTHENTICATED', 'Authentication required');
  }
}
