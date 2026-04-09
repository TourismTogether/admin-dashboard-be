ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "status" varchar(20) DEFAULT 'soon' NOT NULL;
--> statement-breakpoint
UPDATE "events"
SET "status" = CASE WHEN "is_active" = true THEN 'active' ELSE 'inactive' END
WHERE "status" = 'soon';
