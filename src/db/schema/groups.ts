import { pgTable, uuid, varchar, text, timestamp } from "drizzle-orm/pg-core";

export const groups = pgTable("groups", {
  groupId: uuid("group_id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
