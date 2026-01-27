import { pgTable, uuid, boolean, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";

export const userSettings = pgTable("user_settings", {
  settingId: uuid("setting_id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.userId, { onDelete: "cascade" }),
  // Whether to send weekly personal task summary emails
  sendPersonalTasksEmail: boolean("send_personal_tasks_email")
    .notNull()
    .default(false),
  // Target email address for weekly personal task summary
  personalTasksEmail: text("personal_tasks_email"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

