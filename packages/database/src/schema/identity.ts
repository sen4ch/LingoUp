import { sql } from 'drizzle-orm';
import { boolean, check, index, pgSchema, smallint, text, uuid } from 'drizzle-orm/pg-core';
import { CEFR_LEVEL_CHECK, createdAt, primaryId, timestamptz, updatedAt } from './_columns.js';

/** Owned by the Identity module. Other schemas may reference `identity.users(id)` only. */
export const identitySchema = pgSchema('identity');

export const users = identitySchema.table(
  'users',
  {
    id: primaryId(),
    /** Stored lowercased by the application. */
    email: text('email').notNull().unique('users_email_key'),
    passwordHash: text('password_hash').notNull(),
    displayName: text('display_name').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check('users_email_lowercase', sql`${t.email} = lower(${t.email})`),
    check('users_display_name_length', sql`char_length(${t.displayName}) BETWEEN 1 AND 60`),
  ],
);

export const sessions = identitySchema.table(
  'sessions',
  {
    id: primaryId(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** SHA-256 of the session token (hex). The token itself is never stored. */
    tokenHash: text('token_hash').notNull().unique('sessions_token_hash_key'),
    createdAt: createdAt(),
    expiresAt: timestamptz('expires_at').notNull(),
    lastSeenAt: timestamptz('last_seen_at').notNull().defaultNow(),
  },
  (t) => [
    index('sessions_user_id_idx').on(t.userId),
    index('sessions_expires_at_idx').on(t.expiresAt),
  ],
);

export const userSettings = identitySchema.table(
  'user_settings',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    nativeLanguage: text('native_language').notNull().default('en'),
    targetLevel: text('target_level').notNull().default('B1'),
    dailyGoalMinutes: smallint('daily_goal_minutes').notNull().default(15),
    /** Explicit consent to send user content to external AI providers. Off by default. */
    aiDataSharing: boolean('ai_data_sharing').notNull().default(false),
    updatedAt: updatedAt(),
  },
  (t) => [
    check('user_settings_target_level', sql`${t.targetLevel} ${CEFR_LEVEL_CHECK}`),
    check('user_settings_daily_goal', sql`${t.dailyGoalMinutes} BETWEEN 5 AND 240`),
  ],
);
