ALTER TABLE "personal_learning_notes" ADD COLUMN IF NOT EXISTS "daily_score" integer;
--> statement-breakpoint
ALTER TABLE "personal_learning_notes" ADD CONSTRAINT "personal_learning_notes_daily_score_range" CHECK ("daily_score" IS NULL OR ("daily_score" >= 1 AND "daily_score" <= 10));
