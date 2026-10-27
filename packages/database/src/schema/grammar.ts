import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  jsonb,
  pgSchema,
  smallint,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { CEFR_LEVEL_CHECK, createdAt, primaryId, timestamptz, updatedAt } from './_columns.js';
import { users } from './identity.js';

/** Owned by the Grammar module: topics and exercises (content) and learners' attempts. */
export const grammarSchema = pgSchema('grammar');

export const topics = grammarSchema.table(
  'topics',
  {
    id: primaryId(),
    slug: text('slug').notNull().unique('topics_slug_key'),
    title: text('title').notNull(),
    level: text('level').notNull(),
    summary: text('summary').notNull(),
    /** Rule explanation as structured blocks (headings, paragraphs, lists, examples). */
    blocks: jsonb('blocks').notNull(),
    author: text('author').notNull(),
    license: text('license').notNull(),
    provenance: text('provenance').notNull(),
    contentHash: text('content_hash').notNull(),
    publishedAt: timestamptz('published_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check('topics_level', sql`${t.level} ${CEFR_LEVEL_CHECK}`),
    check(
      'topics_provenance',
      sql`${t.provenance} IN ('human', 'ai-assisted', 'ai-generated', 'third-party')`,
    ),
    index('topics_level_idx').on(t.level),
  ],
);

export const exercises = grammarSchema.table(
  'exercises',
  {
    id: primaryId(),
    topicId: uuid('topic_id')
      .notNull()
      .references(() => topics.id, { onDelete: 'cascade' }),
    position: smallint('position').notNull(),
    /** choice: pick one option; gap: type the missing word(s). */
    kind: text('kind').notNull(),
    prompt: text('prompt').notNull(),
    options: text('options')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    /** Accepted answers, normalized. Never sent to the client before an attempt. */
    answers: text('answers').array().notNull(),
    explanation: text('explanation'),
  },
  (t) => [
    uniqueIndex('exercises_topic_position_key').on(t.topicId, t.position),
    check('exercises_kind', sql`${t.kind} IN ('choice', 'gap')`),
  ],
);

export const attempts = grammarSchema.table(
  'attempts',
  {
    id: primaryId(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    exerciseId: uuid('exercise_id')
      .notNull()
      .references(() => exercises.id, { onDelete: 'cascade' }),
    answer: text('answer').notNull(),
    correct: boolean('correct').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index('attempts_user_exercise_idx').on(t.userId, t.exerciseId, t.createdAt),
    check('attempts_answer_length', sql`char_length(${t.answer}) <= 200`),
  ],
);
