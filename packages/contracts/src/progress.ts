import { z } from 'zod';
import { IsoDateTimeSchema } from './common.js';

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
