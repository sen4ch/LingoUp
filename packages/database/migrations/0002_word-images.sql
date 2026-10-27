CREATE TABLE "vocabulary"."word_images" (
	"word_id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"data" "bytea" NOT NULL,
	"mime_type" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"source" text NOT NULL,
	"source_id" text,
	"title" text,
	"creator" text,
	"license" text,
	"license_url" text,
	"landing_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "word_images_source" CHECK ("vocabulary"."word_images"."source" IN ('wikimedia', 'openverse', 'upload'))
);
--> statement-breakpoint
ALTER TABLE "vocabulary"."word_images" ADD CONSTRAINT "word_images_word_id_words_id_fk" FOREIGN KEY ("word_id") REFERENCES "vocabulary"."words"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vocabulary"."word_images" ADD CONSTRAINT "word_images_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "word_images_user_id_idx" ON "vocabulary"."word_images" USING btree ("user_id");