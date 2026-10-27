CREATE SCHEMA "grammar";
--> statement-breakpoint
CREATE TABLE "grammar"."attempts" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"exercise_id" uuid NOT NULL,
	"answer" text NOT NULL,
	"correct" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attempts_answer_length" CHECK (char_length("grammar"."attempts"."answer") <= 200)
);
--> statement-breakpoint
CREATE TABLE "grammar"."exercises" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"topic_id" uuid NOT NULL,
	"position" smallint NOT NULL,
	"kind" text NOT NULL,
	"prompt" text NOT NULL,
	"options" text[] DEFAULT '{}'::text[] NOT NULL,
	"answers" text[] NOT NULL,
	"explanation" text,
	CONSTRAINT "exercises_kind" CHECK ("grammar"."exercises"."kind" IN ('choice', 'gap'))
);
--> statement-breakpoint
CREATE TABLE "grammar"."topics" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"level" text NOT NULL,
	"summary" text NOT NULL,
	"blocks" jsonb NOT NULL,
	"author" text NOT NULL,
	"license" text NOT NULL,
	"provenance" text NOT NULL,
	"content_hash" text NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "topics_slug_key" UNIQUE("slug"),
	CONSTRAINT "topics_level" CHECK ("grammar"."topics"."level" IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
	CONSTRAINT "topics_provenance" CHECK ("grammar"."topics"."provenance" IN ('human', 'ai-assisted', 'ai-generated', 'third-party'))
);
--> statement-breakpoint
ALTER TABLE "progress"."daily_activity" DROP CONSTRAINT "daily_activity_non_negative";--> statement-breakpoint
ALTER TABLE "content"."texts" ADD COLUMN "provenance" text DEFAULT 'human' NOT NULL;--> statement-breakpoint
ALTER TABLE "content"."texts" ADD COLUMN "owner_user_id" uuid;--> statement-breakpoint
ALTER TABLE "content"."texts" ADD COLUMN "focus_terms" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "progress"."daily_activity" ADD COLUMN "exercises_done" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "grammar"."attempts" ADD CONSTRAINT "attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grammar"."attempts" ADD CONSTRAINT "attempts_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "grammar"."exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grammar"."exercises" ADD CONSTRAINT "exercises_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "grammar"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attempts_user_exercise_idx" ON "grammar"."attempts" USING btree ("user_id","exercise_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "exercises_topic_position_key" ON "grammar"."exercises" USING btree ("topic_id","position");--> statement-breakpoint
CREATE INDEX "topics_level_idx" ON "grammar"."topics" USING btree ("level");--> statement-breakpoint
ALTER TABLE "content"."texts" ADD CONSTRAINT "texts_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "identity"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "texts_owner_user_id_idx" ON "content"."texts" USING btree ("owner_user_id");--> statement-breakpoint
ALTER TABLE "content"."texts" ADD CONSTRAINT "texts_provenance" CHECK ("content"."texts"."provenance" IN ('human', 'ai-assisted', 'ai-generated', 'third-party'));--> statement-breakpoint
ALTER TABLE "progress"."daily_activity" ADD CONSTRAINT "daily_activity_non_negative" CHECK ("progress"."daily_activity"."words_saved" >= 0 AND "progress"."daily_activity"."reviews_done" >= 0 AND "progress"."daily_activity"."texts_completed" >= 0 AND "progress"."daily_activity"."exercises_done" >= 0);