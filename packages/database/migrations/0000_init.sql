CREATE SCHEMA "content";
--> statement-breakpoint
CREATE SCHEMA "identity";
--> statement-breakpoint
CREATE SCHEMA "vocabulary";
--> statement-breakpoint
CREATE SCHEMA "learning";
--> statement-breakpoint
CREATE SCHEMA "progress";
--> statement-breakpoint
CREATE SCHEMA "platform";
--> statement-breakpoint
CREATE TABLE "content"."glossary_entries" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"text_id" uuid NOT NULL,
	"term" text NOT NULL,
	"normalized_term" text NOT NULL,
	"part_of_speech" text,
	"definition" text NOT NULL,
	"translation" text,
	"example" text
);
--> statement-breakpoint
CREATE TABLE "content"."texts" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"level" text NOT NULL,
	"summary" text NOT NULL,
	"paragraphs" text[] NOT NULL,
	"topics" text[] DEFAULT '{}'::text[] NOT NULL,
	"word_count" integer NOT NULL,
	"author" text NOT NULL,
	"license" text NOT NULL,
	"content_hash" text NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "texts_slug_key" UNIQUE("slug"),
	CONSTRAINT "texts_level" CHECK ("content"."texts"."level" IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
	CONSTRAINT "texts_word_count" CHECK ("content"."texts"."word_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "identity"."sessions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_hash_key" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "identity"."user_settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"native_language" text DEFAULT 'ru' NOT NULL,
	"target_level" text DEFAULT 'B1' NOT NULL,
	"daily_goal_minutes" smallint DEFAULT 15 NOT NULL,
	"ai_data_sharing" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_settings_target_level" CHECK ("identity"."user_settings"."target_level" IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
	CONSTRAINT "user_settings_daily_goal" CHECK ("identity"."user_settings"."daily_goal_minutes" BETWEEN 5 AND 240)
);
--> statement-breakpoint
CREATE TABLE "identity"."users" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"display_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_key" UNIQUE("email"),
	CONSTRAINT "users_email_lowercase" CHECK ("identity"."users"."email" = lower("identity"."users"."email")),
	CONSTRAINT "users_display_name_length" CHECK (char_length("identity"."users"."display_name") BETWEEN 1 AND 60)
);
--> statement-breakpoint
CREATE TABLE "vocabulary"."cards" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"word_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"state" text NOT NULL,
	"due" timestamp with time zone NOT NULL,
	"stability" double precision NOT NULL,
	"difficulty" double precision NOT NULL,
	"scheduled_days" integer NOT NULL,
	"learning_steps" integer NOT NULL,
	"reps" integer NOT NULL,
	"lapses" integer NOT NULL,
	"last_review_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cards_state" CHECK ("vocabulary"."cards"."state" IN ('new', 'learning', 'review', 'relearning')),
	CONSTRAINT "cards_counters" CHECK ("vocabulary"."cards"."reps" >= 0 AND "vocabulary"."cards"."lapses" >= 0)
);
--> statement-breakpoint
CREATE TABLE "vocabulary"."review_logs" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"card_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"client_review_id" uuid NOT NULL,
	"rating" text NOT NULL,
	"previous_state" text NOT NULL,
	"next_state" text NOT NULL,
	"previous_due" timestamp with time zone NOT NULL,
	"next_due" timestamp with time zone NOT NULL,
	"stability" double precision NOT NULL,
	"difficulty" double precision NOT NULL,
	"scheduled_days" integer NOT NULL,
	"duration_ms" integer,
	"reviewed_at" timestamp with time zone NOT NULL,
	"algorithm" smallint DEFAULT 5 NOT NULL,
	CONSTRAINT "review_logs_rating" CHECK ("vocabulary"."review_logs"."rating" IN ('again', 'hard', 'good', 'easy')),
	CONSTRAINT "review_logs_previous_state" CHECK ("vocabulary"."review_logs"."previous_state" IN ('new', 'learning', 'review', 'relearning')),
	CONSTRAINT "review_logs_next_state" CHECK ("vocabulary"."review_logs"."next_state" IN ('new', 'learning', 'review', 'relearning')),
	CONSTRAINT "review_logs_duration" CHECK ("vocabulary"."review_logs"."duration_ms" IS NULL OR "vocabulary"."review_logs"."duration_ms" >= 0)
);
--> statement-breakpoint
CREATE TABLE "vocabulary"."words" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"term" text NOT NULL,
	"normalized_term" text NOT NULL,
	"definition" text,
	"translation" text,
	"context_sentence" text,
	"source_text_id" uuid,
	"source_text_slug" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learning"."text_completions" (
	"user_id" uuid NOT NULL,
	"text_id" uuid NOT NULL,
	"text_slug" text NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "text_completions_pkey" PRIMARY KEY("user_id","text_id")
);
--> statement-breakpoint
CREATE TABLE "progress"."daily_activity" (
	"user_id" uuid NOT NULL,
	"day" date NOT NULL,
	"words_saved" integer DEFAULT 0 NOT NULL,
	"reviews_done" integer DEFAULT 0 NOT NULL,
	"texts_completed" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_activity_pkey" PRIMARY KEY("user_id","day"),
	CONSTRAINT "daily_activity_non_negative" CHECK ("progress"."daily_activity"."words_saved" >= 0 AND "progress"."daily_activity"."reviews_done" >= 0 AND "progress"."daily_activity"."texts_completed" >= 0)
);
--> statement-breakpoint
CREATE TABLE "platform"."outbox_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"version" smallint NOT NULL,
	"user_id" uuid,
	"event" jsonb NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"published_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text
);
--> statement-breakpoint
CREATE TABLE "platform"."processed_events" (
	"consumer" text NOT NULL,
	"event_id" uuid NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "processed_events_pkey" PRIMARY KEY("consumer","event_id")
);
--> statement-breakpoint
ALTER TABLE "content"."glossary_entries" ADD CONSTRAINT "glossary_entries_text_id_texts_id_fk" FOREIGN KEY ("text_id") REFERENCES "content"."texts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity"."sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity"."user_settings" ADD CONSTRAINT "user_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vocabulary"."cards" ADD CONSTRAINT "cards_word_id_words_id_fk" FOREIGN KEY ("word_id") REFERENCES "vocabulary"."words"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vocabulary"."cards" ADD CONSTRAINT "cards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vocabulary"."review_logs" ADD CONSTRAINT "review_logs_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "vocabulary"."cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vocabulary"."review_logs" ADD CONSTRAINT "review_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vocabulary"."words" ADD CONSTRAINT "words_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning"."text_completions" ADD CONSTRAINT "text_completions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress"."daily_activity" ADD CONSTRAINT "daily_activity_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "glossary_entries_text_term_key" ON "content"."glossary_entries" USING btree ("text_id","normalized_term");--> statement-breakpoint
CREATE INDEX "texts_level_published_idx" ON "content"."texts" USING btree ("level","published_at");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "identity"."sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_at_idx" ON "identity"."sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "cards_word_id_key" ON "vocabulary"."cards" USING btree ("word_id");--> statement-breakpoint
CREATE INDEX "cards_user_due_idx" ON "vocabulary"."cards" USING btree ("user_id","due");--> statement-breakpoint
CREATE UNIQUE INDEX "review_logs_user_client_review_key" ON "vocabulary"."review_logs" USING btree ("user_id","client_review_id");--> statement-breakpoint
CREATE INDEX "review_logs_card_id_idx" ON "vocabulary"."review_logs" USING btree ("card_id");--> statement-breakpoint
CREATE INDEX "review_logs_user_reviewed_at_idx" ON "vocabulary"."review_logs" USING btree ("user_id","reviewed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "words_user_term_key" ON "vocabulary"."words" USING btree ("user_id","normalized_term");--> statement-breakpoint
CREATE INDEX "words_user_id_id_idx" ON "vocabulary"."words" USING btree ("user_id","id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "outbox_events_unpublished_idx" ON "platform"."outbox_events" USING btree ("occurred_at") WHERE "platform"."outbox_events"."published_at" IS NULL;--> statement-breakpoint
CREATE INDEX "outbox_events_published_at_idx" ON "platform"."outbox_events" USING btree ("published_at") WHERE "platform"."outbox_events"."published_at" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "outbox_events_user_id_idx" ON "platform"."outbox_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "processed_events_processed_at_idx" ON "platform"."processed_events" USING btree ("processed_at");