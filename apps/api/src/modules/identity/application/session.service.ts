import { Inject, Injectable } from '@nestjs/common';
import type { AppConfig } from '../../../config/app-config.js';
import { APP_CONFIG } from '../../../platform/index.js';
import type { AuthenticatedUser } from '../domain/authenticated-user.js';
import {
  generateSessionToken,
  hashSessionToken,
  isWellFormedToken,
} from '../domain/session-token.js';
import { IdentityRepository } from '../infrastructure/identity.repository.js';

const TOUCH_INTERVAL_MS = 60 * 60 * 1000;

@Injectable()
export class SessionService {
  constructor(
    private readonly repository: IdentityRepository,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  get ttlMs(): number {
    return this.config.session.ttlDays * 24 * 60 * 60 * 1000;
  }

  /** Returns the raw token for the cookie; only its hash is persisted. */
  async create(userId: string, now = new Date()): Promise<{ token: string; expiresAt: Date }> {
    const token = generateSessionToken();
    const expiresAt = new Date(now.getTime() + this.ttlMs);
    await this.repository.deleteExpiredSessions(userId, now);
    await this.repository.insertSession(userId, hashSessionToken(token), expiresAt);
    return { token, expiresAt };
  }

  async resolve(token: string, now = new Date()): Promise<AuthenticatedUser | null> {
    if (!isWellFormedToken(token)) return null;
    const session = await this.repository.findActiveSession(hashSessionToken(token), now);
    if (!session) return null;
    // Throttled write: last-seen is informational, not worth a write per request.
    if (now.getTime() - session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
      await this.repository.touchSession(session.id, now);
    }
    return { id: session.userId, sessionId: session.id };
  }

  revoke(sessionId: string): Promise<void> {
    return this.repository.deleteSession(sessionId);
  }
}
