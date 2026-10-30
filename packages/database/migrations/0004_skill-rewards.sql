CREATE TABLE "progress"."skill_rewards" (
	"user_id" uuid NOT NULL,
	"skill" text NOT NULL,
	"source_key" text NOT NULL,
	"earned_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "skill_rewards_pkey" PRIMARY KEY("user_id","skill","source_key"),
	CONSTRAINT "skill_rewards_skill" CHECK ("progress"."skill_rewards"."skill" IN ('reading','listening','speaking','writing','grammar','vocabulary'))
);
--> statement-breakpoint
ALTER TABLE "progress"."skill_rewards" ADD CONSTRAINT "skill_rewards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "skill_rewards_user_earned_idx" ON "progress"."skill_rewards" USING btree ("user_id","earned_at");
--> statement-breakpoint
INSERT INTO progress.skill_rewards (user_id, skill, source_key, earned_at)
SELECT user_id, 'reading', text_id::text, completed_at FROM learning.text_completions
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO progress.skill_rewards (user_id, skill, source_key, earned_at)
SELECT user_id, 'grammar', 'exercise:' || exercise_id::text, min(created_at)
FROM grammar.attempts WHERE correct GROUP BY user_id, exercise_id
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO progress.skill_rewards (user_id, skill, source_key, earned_at)
SELECT user_id, 'vocabulary', 'save:' || id::text, created_at FROM vocabulary.words
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO progress.skill_rewards (user_id, skill, source_key, earned_at)
SELECT user_id, 'vocabulary', 'review:' || card_id::text || ':' || (reviewed_at AT TIME ZONE 'UTC')::date::text, min(reviewed_at)
FROM vocabulary.review_logs WHERE rating <> 'again'
GROUP BY user_id, card_id, (reviewed_at AT TIME ZONE 'UTC')::date
ON CONFLICT DO NOTHING;
