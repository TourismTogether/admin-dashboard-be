import { pgTable, uuid, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";
import { userAdmin } from "./userAdmin";

export const feedback = pgTable("feedback", {
  feedbackId: uuid("feedback_id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 500 }).notNull(),
  reason: text("reason").notNull(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.userId, { onDelete: "cascade" }),
  adminResponse: text("admin_response"),
  adminUserId: uuid("admin_user_id").references(() => userAdmin.adminId, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
