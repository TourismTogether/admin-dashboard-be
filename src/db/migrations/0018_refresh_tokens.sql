CREATE TABLE IF NOT EXISTS "refresh_tokens" (
  "token_id" uuid PRIMARY KEY NOT NULL,
  "user_id" uuid NOT NULL,
  "token_hash" varchar(64) NOT NULL,
  "replaced_by_token_id" uuid,
  "revoked_at" timestamp with time zone,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "refresh_tokens_token_hash_unique" UNIQUE("token_hash"),
  CONSTRAINT "refresh_tokens_user_id_users_user_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action
);

CREATE INDEX IF NOT EXISTS "refresh_tokens_user_id_idx" ON "refresh_tokens" ("user_id");
