CREATE TABLE "progress"."focus_time" (
	"user_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"skill" text NOT NULL,
	"day" date NOT NULL,
	"milliseconds" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "focus_time_user_id_session_id_pk" PRIMARY KEY("user_id","session_id"),
	CONSTRAINT "focus_time_milliseconds" CHECK ("progress"."focus_time"."milliseconds" BETWEEN 0 AND 86400000),
	CONSTRAINT "focus_time_skill" CHECK ("progress"."focus_time"."skill" IN ('reading','listening','speaking','writing','grammar','vocabulary'))
);
--> statement-breakpoint
ALTER TABLE "progress"."focus_time" ADD CONSTRAINT "focus_time_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "focus_time_user_day_idx" ON "progress"."focus_time" USING btree ("user_id","day");