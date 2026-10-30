import { primaryKey, pgSchema, text, uuid, jsonb, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { timestamptz, primaryId, createdAt } from './_columns.js';
import { users } from './identity.js';

/** Owned by the Learning module. */
export const learningSchema = pgSchema('learning');

export const readingChecks = learningSchema.table(
  'reading_checks',
  {
    id: primaryId(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    textId: uuid('text_id').notNull(),
    textSlug: text('text_slug').notNull(),
    version: text('version').notNull(),
    source: text('source').notNull(),
    content: jsonb('content').$type<unknown>().notNull(),
    answers: jsonb('answers').$type<number[]>(),
    createdAt: createdAt(),
    answeredAt: timestamptz('answered_at'),
  },
  (table) => [
    uniqueIndex('reading_checks_user_text_version_idx').on(
      table.userId,
      table.textId,
      table.version,
    ),
    index('reading_checks_user_idx').on(table.userId),
  ],
);

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
