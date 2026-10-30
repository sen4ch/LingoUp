CREATE TABLE "learning"."reading_checks" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"text_id" uuid NOT NULL,
	"text_slug" text NOT NULL,
	"version" text NOT NULL,
	"source" text NOT NULL,
	"content" jsonb NOT NULL,
	"answers" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"answered_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "learning"."reading_checks" ADD CONSTRAINT "reading_checks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "reading_checks_user_text_version_idx" ON "learning"."reading_checks" USING btree ("user_id","text_id","version");--> statement-breakpoint
CREATE INDEX "reading_checks_user_idx" ON "learning"."reading_checks" USING btree ("user_id");