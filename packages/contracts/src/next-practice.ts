import { z } from 'zod';
import { CefrLevelSchema, UuidSchema } from './common.js';
import { LearningSkillSchema } from './progress.js';

export const NextPracticeSchema = z.object({
  accountId: UuidSchema,
  day: z.iso.date(),
  level: CefrLevelSchema,
  state: z.enum(['ready', 'setup', 'complete']),
  title: z.string(),
  message: z.string(),
  href: z.string().regex(/^\/(?!\/)/),
  notes: z.array(z.string()).max(6),
  activity: z
    .object({
      skill: LearningSkillSchema,
      title: z.string(),
      minutes: z.number().int().positive(),
      completed: z.number().int().nonnegative(),
      target: z.number().int().positive(),
    })
    .nullable(),
});
export type NextPractice = z.infer<typeof NextPracticeSchema>;
