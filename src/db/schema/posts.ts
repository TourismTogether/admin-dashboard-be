import { pgTable, uuid, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";
import { categories } from "./categories";

export const posts = pgTable("posts", {
	postId: uuid("post_id").defaultRandom().primaryKey(),
	userId: uuid("user_id")
		.notNull()
		.references(() => users.userId, { onDelete: "cascade" }),
	categoryId: uuid("category_id")
		.notNull()
		.references(() => categories.categoryId, { onDelete: "cascade" }),
	title: varchar("title", { length: 255 }),
	content: text("content"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
});