-- Rename columns from github_* to new names (removing github prefix)
ALTER TABLE "portfolios" RENAME COLUMN "github_username" TO "username";
ALTER TABLE "portfolios" RENAME COLUMN "github_bio" TO "bio";
ALTER TABLE "portfolios" RENAME COLUMN "github_avatar_url" TO "avatar_url";
ALTER TABLE "portfolios" RENAME COLUMN "github_readme" TO "readme";
ALTER TABLE "portfolios" RENAME COLUMN "github_location" TO "location";
ALTER TABLE "portfolios" RENAME COLUMN "github_company" TO "company";
ALTER TABLE "portfolios" RENAME COLUMN "github_blog" TO "blog";
ALTER TABLE "portfolios" RENAME COLUMN "github_twitter_username" TO "twitter_username";
--> statement-breakpoint
-- Drop columns that are no longer needed
ALTER TABLE "portfolios" DROP COLUMN IF EXISTS "github_followers";
ALTER TABLE "portfolios" DROP COLUMN IF EXISTS "github_following";
ALTER TABLE "portfolios" DROP COLUMN IF EXISTS "github_public_repos";
