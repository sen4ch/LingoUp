import { Inject, Injectable } from '@nestjs/common';
import {
  LEARNING_SKILLS,
  type FocusTimeBatch,
  type LearningSkill,
  type WeeklyReport,
} from '@lingoup/contracts';
import { shiftStudyDay, studyDay, studyWeek, STUDY_TIME_ZONE } from '@lingoup/learning-engine';
import type { Database } from '@lingoup/database';
import { focusTime, skillRewards, mistakeEntries } from '@lingoup/database/schema/progress';
import { and, eq, gte, lt, sql } from 'drizzle-orm';
import {
  DATABASE,
  DomainError,
  PersonalDataRegistry,
  type PersonalDataExporter,
} from '../../../platform/index.js';
import { UserSettingsQuery } from '../../identity/index.js';
import { gameLevel } from '../domain/development.js';

const SKILL_NAMES: Record<LearningSkill, string> = {
  reading: 'Reading',
  listening: 'Listening',
  speaking: 'Speaking',
  writing: 'Writing',
  grammar: 'Grammar',
  vocabulary: 'Vocabulary',
};
const SKILL_LINKS: Record<LearningSkill, string> = {
  reading: '/library',
  listening: '/listening',
  speaking: '/speaking',
  writing: '/writing',
  grammar: '/grammar',
  vocabulary: '/review',
};

@Injectable()
export class WeeklyReportService implements PersonalDataExporter {
  readonly section = 'studyTime';
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly settings: UserSettingsQuery,
    registry: PersonalDataRegistry,
  ) {
    registry.register(this);
  }

  async record(userId: string, input: FocusTimeBatch, now = new Date()) {
    if (input.accountId !== userId)
      throw new DomainError('FORBIDDEN', 'Timer account does not match your session');
    const today = studyDay(now);
    if (input.entries.some((entry) => entry.day > today || entry.day < shiftStudyDay(today, -90)))
      throw new DomainError('VALIDATION_FAILED', 'Timer dates must be within the past 90 days');
    await this.db.transaction(async (tx) => {
      for (const entry of input.entries) {
        const [saved] = await tx
          .insert(focusTime)
          .values({
            userId,
            sessionId: entry.id,
            skill: entry.skill,
            day: entry.day,
            milliseconds: entry.milliseconds,
          })
          .onConflictDoUpdate({
            target: [focusTime.userId, focusTime.sessionId],
            set: {
              milliseconds: sql`greatest(${focusTime.milliseconds}, ${entry.milliseconds})`,
              updatedAt: new Date(),
            },
            setWhere: and(eq(focusTime.skill, entry.skill), eq(focusTime.day, entry.day)),
          })
          .returning({ id: focusTime.sessionId });
        if (!saved)
          throw new DomainError(
            'VALIDATION_FAILED',
            'A timer session cannot change its day or skill',
          );
      }
    });
    return { accepted: input.entries.map((entry) => entry.id) };
  }

  async report(userId: string, offset = 0, now = new Date()): Promise<WeeklyReport> {
    const week = studyWeek(now, offset);
    const previousStart = shiftStudyDay(week.start, -7);
    const startTime = sql`(${week.start}::date::timestamp AT TIME ZONE 'Europe/Kyiv')`;
    const untilTime = sql`(${week.until}::date::timestamp AT TIME ZONE 'Europe/Kyiv')`;
    const previousTime = sql`(${previousStart}::date::timestamp AT TIME ZONE 'Europe/Kyiv')`;
    const [settings, rewards, time, mistakes] = await Promise.all([
      this.settings.getForUser(userId),
      this.db
        .select({
          skill: skillRewards.skill,
          before:
            sql<number>`count(*) filter (where ${skillRewards.earnedAt} < ${startTime})`.mapWith(
              Number,
            ),
          week: sql<number>`count(*) filter (where ${skillRewards.earnedAt} >= ${startTime})`.mapWith(
            Number,
          ),
          previous:
            sql<number>`count(*) filter (where ${skillRewards.earnedAt} >= ${previousTime} and ${skillRewards.earnedAt} < ${startTime})`.mapWith(
              Number,
            ),
          words:
            sql<number>`count(*) filter (where ${skillRewards.earnedAt} >= ${startTime} and ${skillRewards.sourceKey} like 'save:%')`.mapWith(
              Number,
            ),
        })
        .from(skillRewards)
        .where(and(eq(skillRewards.userId, userId), lt(skillRewards.earnedAt, untilTime)))
        .groupBy(skillRewards.skill),
      this.db
        .select({
          day: focusTime.day,
          skill: focusTime.skill,
          milliseconds: sql<number>`sum(${focusTime.milliseconds})`.mapWith(Number),
        })
        .from(focusTime)
        .where(
          and(
            eq(focusTime.userId, userId),
            gte(focusTime.day, previousStart),
            lt(focusTime.day, week.until),
          ),
        )
        .groupBy(focusTime.day, focusTime.skill),
      this.db
        .select({
          type: mistakeEntries.errorType,
          category: mistakeEntries.category,
          open: sql<number>`count(*) filter (where ${mistakeEntries.resolvedAt} is null)`.mapWith(
            Number,
          ),
          total: sql<number>`count(*)`.mapWith(Number),
        })
        .from(mistakeEntries)
        .where(
          and(
            eq(mistakeEntries.userId, userId),
            gte(mistakeEntries.createdAt, startTime),
            lt(mistakeEntries.createdAt, untilTime),
            sql`${mistakeEntries.category} <> 'suggestion'`,
          ),
        )
        .groupBy(mistakeEntries.errorType, mistakeEntries.category),
    ]);
    const xpByDay = await this.db
      .select({
        day: sql<string>`to_char(${skillRewards.earnedAt} AT TIME ZONE 'Europe/Kyiv', 'YYYY-MM-DD')`,
        xp: sql<number>`count(*)`.mapWith(Number),
      })
      .from(skillRewards)
      .where(
        and(
          eq(skillRewards.userId, userId),
          gte(skillRewards.earnedAt, startTime),
          lt(skillRewards.earnedAt, untilTime),
        ),
      )
      .groupBy(sql`to_char(${skillRewards.earnedAt} AT TIME ZONE 'Europe/Kyiv', 'YYYY-MM-DD')`);
    const secondsFor = (predicate: (entry: (typeof time)[number]) => boolean) =>
      Math.floor(time.filter(predicate).reduce((sum, entry) => sum + entry.milliseconds, 0) / 1000);
    const skills = LEARNING_SKILLS.map((skill) => {
      const reward = rewards.find((row) => row.skill === skill);
      return {
        skill,
        xp: reward?.week ?? 0,
        seconds: secondsFor((row) => row.skill === skill && row.day >= week.start),
        startLevel: gameLevel(reward?.before ?? 0).level,
        endLevel: gameLevel((reward?.before ?? 0) + (reward?.week ?? 0)).level,
      };
    });
    const days = week.days.map((day) => ({
      day,
      xp: xpByDay.find((row) => row.day === day)?.xp ?? 0,
      seconds: secondsFor((row) => row.day === day),
    }));
    const errorsByType = new Map<string, number>();
    for (const row of mistakes) {
      const type = row.type ?? (row.category === 'word' ? 'word_choice' : 'grammar_rule');
      errorsByType.set(type, (errorsByType.get(type) ?? 0) + row.total);
    }
    const commonErrors = [...errorsByType]
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type))
      .slice(0, 3);
    const weekXp = skills.reduce((sum, skill) => sum + skill.xp, 0);
    const open = mistakes.reduce((sum, row) => sum + row.open, 0);
    const least = [...skills].sort((a, b) => a.xp - b.xp)[0]!;
    let nextGoal: WeeklyReport['nextGoal'];
    if (open)
      nextGoal = {
        title: `Review ${Math.min(3, open)} saved ${open === 1 ? 'correction' : 'corrections'}`,
        reason:
          'Revisit the rules behind this week’s unresolved mistakes, then try the phrases again.',
        href: '/mistakes',
        action: 'Review mistakes',
      };
    else if (!weekXp)
      nextGoal = {
        title: 'Complete one reading check',
        reason:
          'Start with one text at your level and answer the comprehension questions. Keep your chosen daily study time.',
        href: '/library',
        action: 'Choose a text',
      };
    else
      nextGoal = {
        title: `Complete 2 ${SKILL_NAMES[least.skill].toLowerCase()} activities`,
        reason: `${SKILL_NAMES[least.skill]} had the fewest XP-earning activities this week. Include two sessions in your existing daily plan.`,
        href: SKILL_LINKS[least.skill],
        action: `Practise ${SKILL_NAMES[least.skill].toLowerCase()}`,
      };
    const beforeXp = rewards.reduce((sum, row) => sum + row.before, 0);
    return {
      generatedAt: now.toISOString(),
      timeZone: STUDY_TIME_ZONE,
      period: { start: week.start, end: week.end, offset, complete: offset > 0 },
      currentWeeklyGoalMinutes: settings.dailyGoalMinutes * 7,
      totals: {
        xp: weekXp,
        previousXp: rewards.reduce((sum, row) => sum + row.previous, 0),
        activeDays: days.filter((day) => day.xp > 0 || day.seconds > 0).length,
        seconds: secondsFor((row) => row.day >= week.start),
        previousSeconds: secondsFor((row) => row.day < week.start),
        wordsAdded: rewards.find((row) => row.skill === 'vocabulary')?.words ?? 0,
        textsRead: skills.find((row) => row.skill === 'reading')!.xp,
        grammarSolved: skills.find((row) => row.skill === 'grammar')!.xp,
        newMistakes: mistakes.reduce((sum, row) => sum + row.total, 0),
        openMistakes: open,
      },
      player: {
        startLevel: gameLevel(beforeXp, 20).level,
        endLevel: gameLevel(beforeXp + weekXp, 20).level,
      },
      skills,
      days,
      commonErrors,
      nextGoal,
    };
  }
  async exportUserData(userId: string) {
    return (await this.db.select().from(focusTime).where(eq(focusTime.userId, userId))).map(
      ({ userId: _userId, ...row }) => ({ ...row, updatedAt: row.updatedAt.toISOString() }),
    );
  }
}
