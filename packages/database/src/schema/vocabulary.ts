import { sql } from 'drizzle-orm';
import {
  check,
  customType,
  doublePrecision,
  index,
  integer,
  pgSchema,
  smallint,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { createdAt, primaryId, timestamptz, updatedAt } from './_columns.js';
import { users } from './identity.js';

/** Owned by the Vocabulary module. Every row belongs to exactly one user. */
export const vocabularySchema = pgSchema('vocabulary');

const CARD_STATE_CHECK = sql`IN ('new', 'learning', 'review', 'relearning')`;

export const words = vocabularySchema.table(
  'words',
  {
    id: primaryId(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    term: text('term').notNull(),
    normalizedTerm: text('normalized_term').notNull(),
    definition: text('definition'),
    translation: text('translation'),
    contextSentence: text('context_sentence'),
    /** Reference into the Content module without a FK (module boundary); slug is a snapshot. */
    sourceTextId: uuid('source_text_id'),
    sourceTextSlug: text('source_text_slug'),
    note: text('note'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('words_user_term_key').on(t.userId, t.normalizedTerm),
    // Keyset pagination: newest first within a user.
    index('words_user_id_id_idx').on(t.userId, t.id.desc()),
  ],
);

export const cards = vocabularySchema.table(
  'cards',
  {
    id: primaryId(),
    wordId: uuid('word_id')
      .notNull()
      .references(() => words.id, { onDelete: 'cascade' }),
    /** Denormalized owner for cheap per-user due queries and access checks. */
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    state: text('state').notNull(),
    due: timestamptz('due').notNull(),
    stability: doublePrecision('stability').notNull(),
    difficulty: doublePrecision('difficulty').notNull(),
    scheduledDays: integer('scheduled_days').notNull(),
    learningSteps: integer('learning_steps').notNull(),
    reps: integer('reps').notNull(),
    lapses: integer('lapses').notNull(),
    lastReviewAt: timestamptz('last_review_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    // One recognition card per word for now; a `kind` column can widen this later.
    uniqueIndex('cards_word_id_key').on(t.wordId),
    index('cards_user_due_idx').on(t.userId, t.due),
    check('cards_state', sql`${t.state} ${CARD_STATE_CHECK}`),
    check('cards_counters', sql`${t.reps} >= 0 AND ${t.lapses} >= 0`),
  ],
);

export const reviewLogs = vocabularySchema.table(
  'review_logs',
  {
    id: primaryId(),
    cardId: uuid('card_id')
      .notNull()
      .references(() => cards.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Idempotency key supplied by the client. */
    clientReviewId: uuid('client_review_id').notNull(),
    rating: text('rating').notNull(),
    previousState: text('previous_state').notNull(),
    nextState: text('next_state').notNull(),
    previousDue: timestamptz('previous_due').notNull(),
    nextDue: timestamptz('next_due').notNull(),
    stability: doublePrecision('stability').notNull(),
    difficulty: doublePrecision('difficulty').notNull(),
    scheduledDays: integer('scheduled_days').notNull(),
    durationMs: integer('duration_ms'),
    reviewedAt: timestamptz('reviewed_at').notNull(),
    /** Version of the scheduling algorithm, for future re-optimization of FSRS parameters. */
    algorithm: smallint('algorithm').notNull().default(5),
  },
  (t) => [
    uniqueIndex('review_logs_user_client_review_key').on(t.userId, t.clientReviewId),
    index('review_logs_card_id_idx').on(t.cardId),
    index('review_logs_user_reviewed_at_idx').on(t.userId, t.reviewedAt),
    check('review_logs_rating', sql`${t.rating} IN ('again', 'hard', 'good', 'easy')`),
    check('review_logs_previous_state', sql`${t.previousState} ${CARD_STATE_CHECK}`),
    check('review_logs_next_state', sql`${t.nextState} ${CARD_STATE_CHECK}`),
    check('review_logs_duration', sql`${t.durationMs} IS NULL OR ${t.durationMs} >= 0`),
  ],
);

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => 'bytea' });

/**
 * One picture per word, chosen by the learner: a free-licensed image found by image
 * search (Wikimedia Commons or Openverse) or their own upload. Stored re-encoded (WebP, metadata stripped), so reviews
 * do not depend on third-party hosts. Attribution fields are required by CC licenses.
 */
export const wordImages = vocabularySchema.table(
  'word_images',
  {
    wordId: uuid('word_id')
      .primaryKey()
      .references(() => words.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    data: bytea('data').notNull(),
    mimeType: text('mime_type').notNull(),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    source: text('source').notNull(),
    /** Image id at the search provider (Wikimedia page id, Openverse UUID). */
    sourceId: text('source_id'),
    title: text('title'),
    creator: text('creator'),
    license: text('license'),
    licenseUrl: text('license_url'),
    landingUrl: text('landing_url'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('word_images_user_id_idx').on(t.userId),
    check('word_images_source', sql`${t.source} IN ('wikimedia', 'openverse', 'upload')`),
  ],
);
