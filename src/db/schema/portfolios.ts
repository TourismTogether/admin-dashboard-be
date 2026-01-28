import { pgTable, uuid, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";

export const portfolios = pgTable("portfolios", {
  portfolioId: uuid("portfolio_id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.userId, { onDelete: "cascade" })
    .unique(), // One portfolio per user
  username: varchar("username", { length: 255 }), // Display name/username
  bio: text("bio"), // Bio/description
  avatarUrl: text("avatar_url"), // Avatar image URL
  readme: text("readme"), // README content (markdown)
  location: varchar("location", { length: 255 }),
  company: varchar("company", { length: 255 }),
  blog: text("blog"), // Website/blog URL
  twitterUsername: varchar("twitter_username", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
