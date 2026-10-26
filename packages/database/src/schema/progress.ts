import { sql } from 'drizzle-orm';
import { check, date, integer, pgSchema, primaryKey, uuid } from 'drizzle-orm/pg-core';
import { updatedAt } from './_columns.js';
import { users } from './identity.js';

/**
 * Owned by the Progress module. Read-model projections built from domain events by the
 * worker; can be rebuilt by replaying events.
 */
export const progressSchema = pgSchema('progress');

export const dailyActivity = progressSchema.table(
  'daily_activity',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** UTC calendar day. */
    day: date('day', { mode: 'string' }).notNull(),
    wordsSaved: integer('words_saved').notNull().default(0),
    reviewsDone: integer('reviews_done').notNull().default(0),
    textsCompleted: integer('texts_completed').notNull().default(0),
    updatedAt: updatedAt(),
  },
  (t) => [
    primaryKey({ name: 'daily_activity_pkey', columns: [t.userId, t.day] }),
    check(
      'daily_activity_non_negative',
      sql`${t.wordsSaved} >= 0 AND ${t.reviewsDone} >= 0 AND ${t.textsCompleted} >= 0`,
    ),
  ],
);
