import { Inject, Injectable } from '@nestjs/common';
import { LearningSkillSchema, type LearningSkill, type ProgressSummary } from '@lingoup/contracts';
import type { Database } from '@lingoup/database';
import { dailyActivity, skillRewards } from '@lingoup/database/schema/progress';
import { and, asc, eq, gte, max, sum, count, sql } from 'drizzle-orm';
import { UserSettingsQuery } from '../../identity/index.js';
import { learningDevelopment } from '../domain/development.js';
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
    private readonly settings: UserSettingsQuery,
  ) {
    personalData.register(this);
  }

  async development(userId: string, now = new Date()) {
    const since = new Date(`${now.toISOString().slice(0, 10)}T00:00:00.000Z`);
    const [settings, rows] = await Promise.all([
      this.settings.getForUser(userId),
      this.db
        .select({
          skill: skillRewards.skill,
          total: count(),
          today:
            sql<number>`count(*) filter (where ${skillRewards.earnedAt} >= ${since.toISOString()}::timestamptz)`.mapWith(
              Number,
            ),
        })
        .from(skillRewards)
        .where(eq(skillRewards.userId, userId))
        .groupBy(skillRewards.skill),
    ]);
    const totals: Partial<Record<LearningSkill, number>> = {};
    const today: Partial<Record<LearningSkill, number>> = {};
    for (const row of rows) {
      const skill = LearningSkillSchema.parse(row.skill);
      totals[skill] = row.total;
      today[skill] = row.today;
    }
    return learningDevelopment(settings.dailyGoalMinutes, settings.targetLevel, totals, today, now);
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
          exercisesDone: dailyActivity.exercisesDone,
        })
        .from(dailyActivity)
        .where(and(eq(dailyActivity.userId, userId), gte(dailyActivity.day, since)))
        .orderBy(asc(dailyActivity.day)),
      this.db
        .select({
          textsCompleted: sum(dailyActivity.textsCompleted),
          exercisesDone: sum(dailyActivity.exercisesDone),
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
      exercisesDone: Number(totals?.exercisesDone ?? 0),
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
      skillRewards: (
        await this.db.select().from(skillRewards).where(eq(skillRewards.userId, userId))
      ).map(({ userId: _userId, ...row }) => row),
    };
  }
}
