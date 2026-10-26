import { Inject, Injectable } from '@nestjs/common';
import type { ProgressSummary } from '@lingoup/contracts';
import type { Database } from '@lingoup/database';
import { dailyActivity } from '@lingoup/database/schema/progress';
import { and, asc, eq, gte, max, sum } from 'drizzle-orm';
import {
  DATABASE,
  PersonalDataRegistry,
  type PersonalDataExporter,
} from '../../../platform/index.js';
import { VocabularyStatsQuery } from '../../vocabulary/index.js';
import { currentStreak, fillActivityWindow } from '../domain/activity.js';

const WINDOW_DAYS = 30;

@Injectable()
export class ProgressService implements PersonalDataExporter {
  readonly section = 'progress';

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly vocabularyStats: VocabularyStatsQuery,
    personalData: PersonalDataRegistry,
  ) {
    personalData.register(this);
  }

  async summary(userId: string, now = new Date()): Promise<ProgressSummary> {
    const since = new Date(now.getTime() - (WINDOW_DAYS - 1) * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const [vocabulary, rows, [totals]] = await Promise.all([
      this.vocabularyStats.forUser(userId, now),
      this.db
        .select({
          day: dailyActivity.day,
          wordsSaved: dailyActivity.wordsSaved,
          reviewsDone: dailyActivity.reviewsDone,
          textsCompleted: dailyActivity.textsCompleted,
        })
        .from(dailyActivity)
        .where(and(eq(dailyActivity.userId, userId), gte(dailyActivity.day, since)))
        .orderBy(asc(dailyActivity.day)),
      this.db
        .select({
          textsCompleted: sum(dailyActivity.textsCompleted),
          updatedAt: max(dailyActivity.updatedAt),
        })
        .from(dailyActivity)
        .where(eq(dailyActivity.userId, userId)),
    ]);
    const activity = fillActivityWindow(rows, now, WINDOW_DAYS);
    return {
      generatedAt: now.toISOString(),
      vocabulary,
      activity,
      textsCompleted: Number(totals?.textsCompleted ?? 0),
      streakDays: currentStreak(activity),
      activityUpdatedAt: totals?.updatedAt ? totals.updatedAt.toISOString() : null,
    };
  }

  async exportUserData(userId: string): Promise<unknown> {
    const rows = await this.db
      .select()
      .from(dailyActivity)
      .where(eq(dailyActivity.userId, userId))
      .orderBy(asc(dailyActivity.day));
    return {
      dailyActivity: rows.map(({ userId: _userId, updatedAt: _updatedAt, ...row }) => row),
    };
  }
}
