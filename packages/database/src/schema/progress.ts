import { sql } from 'drizzle-orm';
import {
  check,
  date,
  index,
  integer,
  jsonb,
  pgSchema,
  primaryKey,
  text,
  uuid,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { timestamptz, updatedAt, primaryId, createdAt } from './_columns.js';
import { users } from './identity.js';

/**
 * Owned by the Progress module. Activity and skill rewards are worker projections;
 * the personal mistake journal is durable learner data, rather than an event projection.
 */
export const progressSchema = pgSchema('progress');

/** Cumulative timer totals per browser session, skill and Kyiv calendar day. */
export const focusTime = progressSchema.table(
  'focus_time',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sessionId: uuid('session_id').notNull(),
    skill: text('skill').notNull(),
    day: date('day', { mode: 'string' }).notNull(),
    milliseconds: integer('milliseconds').notNull(),
    updatedAt: updatedAt(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.sessionId] }),
    index('focus_time_user_day_idx').on(table.userId, table.day),
    check('focus_time_milliseconds', sql`${table.milliseconds} BETWEEN 0 AND 86400000`),
    check(
      'focus_time_skill',
      sql`${table.skill} IN ('reading','listening','speaking','writing','grammar','vocabulary')`,
    ),
  ],
);

/** Personal corrections, captured from server-validated learning feedback. */
export const mistakeEntries = progressSchema.table(
  'mistake_entries',
  {
    id: primaryId(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    fingerprint: text('fingerprint').notNull(),
    source: text('source').notNull(),
    category: text('category').notNull(),
    errorType: text('error_type'),
    original: text('original').notNull(),
    corrected: text('corrected').notNull(),
    explanation: text('explanation').notNull(),
    example: text('example'),
    alternatives: jsonb('alternatives')
      .$type<{ replacement: string; meaning: string }[]>()
      .notNull()
      .default([]),
    context: text('context').notNull(),
    sourceHref: text('source_href').notNull(),
    createdAt: createdAt(),
    resolvedAt: timestamptz('resolved_at'),
  },
  (t) => [
    uniqueIndex('mistake_entries_user_fingerprint_idx').on(t.userId, t.fingerprint),
    index('mistake_entries_user_id_idx').on(t.userId, t.id),
    check('mistake_entries_source', sql`${t.source} IN ('writing','grammar','speaking')`),
    check('mistake_entries_category', sql`${t.category} IN ('word','grammar','suggestion')`),
  ],
);

/** One earned point per completed activity, durable across retries and application restarts. */
export const skillRewards = progressSchema.table(
  'skill_rewards',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    skill: text('skill').notNull(),
    sourceKey: text('source_key').notNull(),
    earnedAt: timestamptz('earned_at').notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ name: 'skill_rewards_pkey', columns: [t.userId, t.skill, t.sourceKey] }),
    index('skill_rewards_user_earned_idx').on(t.userId, t.earnedAt),
    check(
      'skill_rewards_skill',
      sql`${t.skill} IN ('reading','listening','speaking','writing','grammar','vocabulary')`,
    ),
  ],
);

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
    exercisesDone: integer('exercises_done').notNull().default(0),
    updatedAt: updatedAt(),
  },
  (t) => [
    primaryKey({ name: 'daily_activity_pkey', columns: [t.userId, t.day] }),
    check(
      'daily_activity_non_negative',
      sql`${t.wordsSaved} >= 0 AND ${t.reviewsDone} >= 0 AND ${t.textsCompleted} >= 0 AND ${t.exercisesDone} >= 0`,
    ),
  ],
);
