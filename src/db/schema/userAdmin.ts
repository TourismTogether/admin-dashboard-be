import { pgTable, uuid, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";

/** Admin users: only stores which user_id (from users) is an admin. No duplicate email/password. */
export const userAdmin = pgTable("user_admin", {
  adminId: uuid("admin_id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.userId, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
