import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  date,
} from "drizzle-orm/pg-core";
import { groups } from "./groups";

export const groupTasks = pgTable("group_tasks", {
  groupTaskId: uuid("group_task_id").defaultRandom().primaryKey(),
  groupId: uuid("group_id")
    .notNull()
    .references(() => groups.groupId, { onDelete: "cascade" }),
  priority: varchar("priority", { length: 50 }).notNull().default("medium"), // low, medium, high
  status: varchar("status", { length: 50 }).notNull().default("todo"), // todo, in_progress, reopen, done, delay
  startDate: date("start_date"),
  endDate: date("end_date"),
  requirement: text("requirement"),
  delivery: text("delivery"),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
