-- share_table: public share links for personal task tables
CREATE TABLE IF NOT EXISTS "share_table" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"table_id" uuid NOT NULL REFERENCES "public"."table_weeks"("table_id") ON DELETE CASCADE,
	"owner_id" uuid NOT NULL REFERENCES "public"."users"("user_id") ON DELETE CASCADE,
	"share_id" varchar(64) NOT NULL UNIQUE,
	"is_public" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- table_weeks: optional follow-up reference (forked from shared table)
ALTER TABLE "table_weeks" ADD COLUMN IF NOT EXISTS "follow_up_table_id" uuid REFERENCES "public"."table_weeks"("table_id") ON DELETE SET NULL;
