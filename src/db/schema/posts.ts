import { pgTable, uuid, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";
import { postCategories } from "./postCategories";

export const posts = pgTable("posts", {
  postId: uuid("post_id").defaultRandom().primaryKey(),
  authorId: uuid("author_id")
    .notNull()
    .references(() => users.userId, { onDelete: "cascade" }),
  categoryId: uuid("category_id")
    .notNull()
    .references(() => postCategories.categoryId, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
