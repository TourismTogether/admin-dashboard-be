CREATE TABLE "personal_learning_notes" (
	"note_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"note_date" date NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "personal_learning_notes_user_id_note_date_unique" UNIQUE("user_id","note_date")
);
--> statement-breakpoint
ALTER TABLE "personal_learning_notes" ADD CONSTRAINT "personal_learning_notes_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;
