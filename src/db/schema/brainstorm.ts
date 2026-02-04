import { pgTable, uuid, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";

export const brainstorm = pgTable("brainstorm", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.userId, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull().default("Untitled"),
  type: varchar("type", { length: 50 }).notNull(), // mindmap, ER, Class, Git, Kanban, Flowchart, ...
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
