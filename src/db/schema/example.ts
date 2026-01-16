import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  text,
  boolean,
} from "drizzle-orm/pg-core";

// Example table schema - replace with your actual tables
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Add more table schemas here as needed
// Example:
// export const posts = pgTable("posts", {
//   id: uuid("id").defaultRandom().primaryKey(),
//   title: varchar("title", { length: 255 }).notNull(),
//   content: text("content"),
//   userId: uuid("user_id").references(() => users.id),
//   createdAt: timestamp("created_at").defaultNow().notNull(),
// });
