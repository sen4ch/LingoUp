import { Inject, Injectable } from '@nestjs/common';
import type { NativeLanguage, UpdateSettingsRequest, UserSettings } from '@lingoup/contracts';
import type { Database, DbExecutor } from '@lingoup/database';
import { sessions, users, userSettings } from '@lingoup/database/schema/identity';
import { and, eq, gt, lt, sql } from 'drizzle-orm';
import { DATABASE } from '../../../platform/index.js';

export type UserRow = typeof users.$inferSelect;
type SettingsRow = typeof userSettings.$inferSelect;

export function toUserSettings(row: SettingsRow): UserSettings {
  return {
    nativeLanguage: row.nativeLanguage as NativeLanguage,
    targetLevel: row.targetLevel as UserSettings['targetLevel'],
    dailyGoalMinutes: row.dailyGoalMinutes,
    aiDataSharing: row.aiDataSharing,
  };
}

@Injectable()
export class IdentityRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async insertUser(
    tx: DbExecutor,
    input: { email: string; passwordHash: string; displayName: string },
  ): Promise<UserRow> {
    const [user] = await tx.insert(users).values(input).returning();
    await tx.insert(userSettings).values({ userId: user!.id });
    return user!;
  }

  async findUserByEmail(email: string): Promise<UserRow | undefined> {
    return this.db.query.users.findFirst({ where: eq(users.email, email) });
  }

  async findUserWithSettings(userId: string) {
    const [row] = await this.db
      .select({ user: users, settings: userSettings })
      .from(users)
      .innerJoin(userSettings, eq(userSettings.userId, users.id))
      .where(eq(users.id, userId));
    return row;
  }

  async findSettings(userId: string): Promise<UserSettings | undefined> {
    const row = await this.db.query.userSettings.findFirst({
      where: eq(userSettings.userId, userId),
    });
    return row ? toUserSettings(row) : undefined;
  }

  async updateSettings(userId: string, patch: UpdateSettingsRequest): Promise<UserSettings> {
    const [row] = await this.db
      .update(userSettings)
      .set(patch)
      .where(eq(userSettings.userId, userId))
      .returning();
    return toUserSettings(row!);
  }

  async deleteUser(tx: DbExecutor, userId: string): Promise<void> {
    await tx.delete(users).where(eq(users.id, userId));
  }

  async insertSession(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.db.insert(sessions).values({ userId, tokenHash, expiresAt });
  }

  async findActiveSession(tokenHash: string, now: Date) {
    return this.db.query.sessions.findFirst({
      columns: { id: true, userId: true, lastSeenAt: true },
      where: and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, now)),
    });
  }

  async touchSession(sessionId: string, now: Date): Promise<void> {
    await this.db.update(sessions).set({ lastSeenAt: now }).where(eq(sessions.id, sessionId));
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.db.delete(sessions).where(eq(sessions.id, sessionId));
  }

  /** Housekeeping on login: expired sessions are useless and only grow the table. */
  async deleteExpiredSessions(userId: string, now: Date): Promise<void> {
    await this.db
      .delete(sessions)
      .where(and(eq(sessions.userId, userId), lt(sessions.expiresAt, now)));
  }

  async exportUser(userId: string) {
    const row = await this.findUserWithSettings(userId);
    const activeSessions = await this.db
      .select({
        createdAt: sessions.createdAt,
        lastSeenAt: sessions.lastSeenAt,
        expiresAt: sessions.expiresAt,
      })
      .from(sessions)
      .where(eq(sessions.userId, userId))
      .orderBy(sql`${sessions.createdAt} desc`);
    if (!row) return null;
    return {
      email: row.user.email,
      displayName: row.user.displayName,
      createdAt: row.user.createdAt.toISOString(),
      settings: toUserSettings(row.settings),
      sessions: activeSessions.map((s) => ({
        createdAt: s.createdAt.toISOString(),
        lastSeenAt: s.lastSeenAt.toISOString(),
        expiresAt: s.expiresAt.toISOString(),
      })),
    };
  }
}
