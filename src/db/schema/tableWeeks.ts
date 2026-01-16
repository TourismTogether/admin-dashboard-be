import { pgTable, uuid, integer, date, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";

export const tableWeeks = pgTable("table_weeks", {
  tableId: uuid("table_id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.userId, { onDelete: "cascade" }),
  week: integer("week").notNull(),
  startDate: date("start_date").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
