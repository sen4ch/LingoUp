import { z } from 'zod';
import { IsoDateTimeSchema, CefrLevelSchema } from './common.js';

export const LEARNING_SKILLS = [
  'reading',
  'listening',
  'speaking',
  'writing',
  'grammar',
  'vocabulary',
] as const;
export const LearningSkillSchema = z.enum(LEARNING_SKILLS);
export const GameLevelSchema = z.object({
  xp: z.number().int().nonnegative(),
  level: z.number().int().positive(),
  levelXp: z.number().int().nonnegative(),
  nextLevelXp: z.number().int().positive(),
});
export const LearningDevelopmentSchema = z.object({
  generatedAt: IsoDateTimeSchema,
  day: z.iso.date(),
  overall: GameLevelSchema,
  skills: z.array(
    GameLevelSchema.extend({ skill: LearningSkillSchema, todayXp: z.number().int().nonnegative() }),
  ),
  plan: z.object({
    dailyMinutes: z.number().int().min(5).max(240),
    cefrLevel: CefrLevelSchema,
    activities: z.array(
      z.object({
        skill: LearningSkillSchema,
        title: z.string(),
        instruction: z.string(),
        href: z.string(),
        minutes: z.number().int().positive(),
        target: z.number().int().positive(),
        completed: z.number().int().nonnegative(),
      }),
    ),
  }),
});
export type LearningDevelopment = z.infer<typeof LearningDevelopmentSchema>;
export type LearningSkill = z.infer<typeof LearningSkillSchema>;

export const DailyActivitySchema = z.object({
  day: z.iso.date(),
  wordsSaved: z.number().int().nonnegative(),
  reviewsDone: z.number().int().nonnegative(),
  textsCompleted: z.number().int().nonnegative(),
  exercisesDone: z.number().int().nonnegative(),
});
export type DailyActivity = z.infer<typeof DailyActivitySchema>;

export const VocabularyStatsSchema = z.object({
  total: z.number().int().nonnegative(),
  dueNow: z.number().int().nonnegative(),
  byState: z.object({
    new: z.number().int().nonnegative(),
    learning: z.number().int().nonnegative(),
    review: z.number().int().nonnegative(),
    relearning: z.number().int().nonnegative(),
  }),
  totalReviews: z.number().int().nonnegative(),
});
export type VocabularyStats = z.infer<typeof VocabularyStatsSchema>;

export const ProgressSummarySchema = z.object({
  generatedAt: IsoDateTimeSchema,
  vocabulary: VocabularyStatsSchema,
  /** Last 30 days (UTC), oldest first; days without activity are included with zeros. */
  activity: z.array(DailyActivitySchema),
  textsCompleted: z.number().int().nonnegative(),
  exercisesDone: z.number().int().nonnegative(),
  streakDays: z.number().int().nonnegative(),
  /**
   * Activity is an eventually consistent projection built by the worker from domain
   * events; this is the time of its last update, or null if nothing was projected yet.
   */
  activityUpdatedAt: IsoDateTimeSchema.nullable(),
});
export type ProgressSummary = z.infer<typeof ProgressSummarySchema>;
