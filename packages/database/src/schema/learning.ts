import { primaryKey, pgSchema, text, uuid } from 'drizzle-orm/pg-core';
import { timestamptz } from './_columns.js';
import { users } from './identity.js';

/** Owned by the Learning module. */
export const learningSchema = pgSchema('learning');

export const textCompletions = learningSchema.table(
  'text_completions',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Reference into the Content module without a FK (module boundary). */
    textId: uuid('text_id').notNull(),
    textSlug: text('text_slug').notNull(),
    completedAt: timestamptz('completed_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ name: 'text_completions_pkey', columns: [t.userId, t.textId] })],
);
