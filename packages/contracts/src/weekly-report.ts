import { z } from 'zod';
import { UuidSchema, IsoDateTimeSchema } from './common.js';
import { LearningSkillSchema } from './progress.js';

export const FocusTimeBatchSchema = z
  .object({
    accountId: UuidSchema,
    entries: z
      .array(
        z
          .object({
            id: UuidSchema,
            skill: LearningSkillSchema,
            day: z.iso.date(),
            milliseconds: z.number().int().min(0).max(86_400_000),
          })
          .strict(),
      )
      .min(1)
      .max(20),
  })
  .strict();
export type FocusTimeBatch = z.infer<typeof FocusTimeBatchSchema>;
export const FocusTimeAckSchema = z.object({ accepted: z.array(UuidSchema) });
export const WeeklyQuerySchema = z.object({
  offset: z.coerce.number().int().min(0).max(52).default(0),
});
export const WeeklyReportSchema = z.object({
  generatedAt: IsoDateTimeSchema,
  timeZone: z.literal('Europe/Kyiv'),
  period: z.object({
    start: z.iso.date(),
    end: z.iso.date(),
    offset: z.number().int(),
    complete: z.boolean(),
  }),
  totals: z.object({
    xp: z.number().int().nonnegative(),
    previousXp: z.number().int().nonnegative(),
    activeDays: z.number().int().min(0).max(7),
    seconds: z.number().int().nonnegative(),
    previousSeconds: z.number().int().nonnegative(),
    wordsAdded: z.number().int().nonnegative(),
    textsRead: z.number().int().nonnegative(),
    grammarSolved: z.number().int().nonnegative(),
    newMistakes: z.number().int().nonnegative(),
    openMistakes: z.number().int().nonnegative(),
  }),
  player: z.object({
    startLevel: z.number().int().positive(),
    endLevel: z.number().int().positive(),
  }),
  currentWeeklyGoalMinutes: z.number().int().positive(),
  skills: z.array(
    z.object({
      skill: LearningSkillSchema,
      xp: z.number().int().nonnegative(),
      seconds: z.number().int().nonnegative(),
      startLevel: z.number().int().positive(),
      endLevel: z.number().int().positive(),
    }),
  ),
  days: z
    .array(
      z.object({
        day: z.iso.date(),
        xp: z.number().int().nonnegative(),
        seconds: z.number().int().nonnegative(),
      }),
    )
    .length(7),
  commonErrors: z.array(z.object({ type: z.string(), count: z.number().int().positive() })).max(3),
  nextGoal: z.object({
    title: z.string(),
    reason: z.string(),
    href: z.string().startsWith('/'),
    action: z.string(),
  }),
});
export type WeeklyReport = z.infer<typeof WeeklyReportSchema>;
