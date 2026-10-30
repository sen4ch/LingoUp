CREATE TABLE "progress"."mistake_entries" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"fingerprint" text NOT NULL,
	"source" text NOT NULL,
	"category" text NOT NULL,
	"error_type" text,
	"original" text NOT NULL,
	"corrected" text NOT NULL,
	"explanation" text NOT NULL,
	"example" text,
	"alternatives" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"context" text NOT NULL,
	"source_href" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "mistake_entries_source" CHECK ("progress"."mistake_entries"."source" IN ('writing','grammar','speaking')),
	CONSTRAINT "mistake_entries_category" CHECK ("progress"."mistake_entries"."category" IN ('word','grammar','suggestion'))
);
--> statement-breakpoint
ALTER TABLE "progress"."mistake_entries" ADD CONSTRAINT "mistake_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "mistake_entries_user_fingerprint_idx" ON "progress"."mistake_entries" USING btree ("user_id","fingerprint");--> statement-breakpoint
CREATE INDEX "mistake_entries_user_id_idx" ON "progress"."mistake_entries" USING btree ("user_id","id");
--> statement-breakpoint
-- Include existing checked grammar mistakes. Retries of the same answer share a key
-- with new submissions, so importing history cannot create duplicate diary entries.
INSERT INTO progress.mistake_entries
  (user_id, fingerprint, source, category, error_type, original, corrected, explanation, context, source_href, created_at)
SELECT DISTINCT ON (a.user_id, a.exercise_id, lower(btrim(a.answer)))
  a.user_id,
  encode(sha256(convert_to(a.exercise_id::text || ':' || lower(btrim(a.answer)), 'UTF8')), 'hex'),
  'grammar', 'grammar', 'grammar_rule', a.answer, e.answers[1],
  left(coalesce(e.explanation, 'Compare your answer with the accepted form and review the grammar rule.'), 1000),
  left(t.title || ': ' || e.prompt, 1000), '/grammar/' || t.slug, a.created_at
FROM grammar.attempts a
JOIN grammar.exercises e ON e.id = a.exercise_id
JOIN grammar.topics t ON t.id = e.topic_id
WHERE NOT a.correct AND e.answers[1] IS NOT NULL AND t.published_at IS NOT NULL
ORDER BY a.user_id, a.exercise_id, lower(btrim(a.answer)), a.created_at DESC
ON CONFLICT DO NOTHING;
