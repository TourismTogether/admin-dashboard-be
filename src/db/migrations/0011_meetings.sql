-- meetings: video meeting/conferencing feature
CREATE TABLE IF NOT EXISTS "meetings" (
	"meeting_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_task_id" varchar NOT NULL,
	"group_id" uuid NOT NULL REFERENCES "public"."groups"("group_id") ON DELETE CASCADE,
	"created_by" uuid NOT NULL REFERENCES "public"."users"("user_id") ON DELETE CASCADE,
	"meeting_code" varchar UNIQUE NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"start_time" timestamp with time zone,
	"end_time" timestamp with time zone,
	"recording_url" text,
	"recording_size" integer,
	"max_participants" integer DEFAULT 100 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- meeting_participants: tracks who is in the meeting
CREATE TABLE IF NOT EXISTS "meeting_participants" (
	"participant_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid NOT NULL REFERENCES "public"."meetings"("meeting_id") ON DELETE CASCADE,
	"user_id" uuid NOT NULL REFERENCES "public"."users"("user_id") ON DELETE CASCADE,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"left_at" timestamp with time zone,
	"is_mic_on" boolean DEFAULT true NOT NULL,
	"is_camera_on" boolean DEFAULT true NOT NULL,
	"is_presenting" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- meeting_chats: chat messages during meetings
CREATE TABLE IF NOT EXISTS "meeting_chats" (
	"chat_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid NOT NULL REFERENCES "public"."meetings"("meeting_id") ON DELETE CASCADE,
	"user_id" uuid NOT NULL REFERENCES "public"."users"("user_id") ON DELETE CASCADE,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- meeting_recordings: stores recording metadata
CREATE TABLE IF NOT EXISTS "meeting_recordings" (
	"recording_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid NOT NULL REFERENCES "public"."meetings"("meeting_id") ON DELETE CASCADE,
	"storage_path" text NOT NULL,
	"duration" integer,
	"size" integer,
	"status" varchar(50) DEFAULT 'processing' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS "idx_meetings_group_id" ON "meetings"("group_id");
CREATE INDEX IF NOT EXISTS "idx_meetings_created_by" ON "meetings"("created_by");
CREATE INDEX IF NOT EXISTS "idx_meeting_participants_meeting_id" ON "meeting_participants"("meeting_id");
CREATE INDEX IF NOT EXISTS "idx_meeting_participants_user_id" ON "meeting_participants"("user_id");
CREATE INDEX IF NOT EXISTS "idx_meeting_chats_meeting_id" ON "meeting_chats"("meeting_id");
CREATE INDEX IF NOT EXISTS "idx_meeting_chats_user_id" ON "meeting_chats"("user_id");
CREATE INDEX IF NOT EXISTS "idx_meeting_recordings_meeting_id" ON "meeting_recordings"("meeting_id");
