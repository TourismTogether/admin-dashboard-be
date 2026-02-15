-- user_admin: change to only store user_id (FK to users), no duplicate email/password
-- So admin = existing user in users table; no conflict.

ALTER TABLE "feedback" DROP CONSTRAINT IF EXISTS "feedback_admin_user_id_user_admin_admin_id_fk";
--> statement-breakpoint
DROP TABLE IF EXISTS "user_admin";
--> statement-breakpoint
CREATE TABLE "user_admin" (
	"admin_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL UNIQUE REFERENCES "public"."users"("user_id") ON DELETE CASCADE,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_admin_user_id_user_admin_admin_id_fk" 
  FOREIGN KEY ("admin_user_id") REFERENCES "public"."user_admin"("admin_id") ON DELETE SET NULL ON UPDATE NO ACTION;
