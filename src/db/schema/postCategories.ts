import { pgTable, uuid, varchar, text, timestamp } from "drizzle-orm/pg-core";

export const postCategories = pgTable("post_categories", {
  categoryId: uuid("category_id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});