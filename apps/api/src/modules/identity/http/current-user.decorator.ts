import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { DomainError } from '../../../platform/index.js';
import type { AuthenticatedUser } from '../domain/authenticated-user.js';

/** Injects the authenticated user; fails closed if a route forgot to require a session. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const user = context.switchToHttp().getRequest<FastifyRequest>().user;
    if (!user) throw new DomainError('UNAUTHENTICATED', 'Authentication required');
    return user;
  },
);
