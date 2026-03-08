-- Add difficulty column to personal_tasks: easy | medium | hard, default medium
ALTER TABLE "personal_tasks" ADD COLUMN IF NOT EXISTS "difficulty" varchar(20) DEFAULT 'medium' NOT NULL;
