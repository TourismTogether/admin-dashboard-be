import { pgTable, uuid, text, varchar, timestamp } from "drizzle-orm/pg-core";
import { tableSwimlanes } from "./tableSwimlanes";

export const personalTasks = pgTable("personal_tasks", {
  taskId: uuid("task_id").defaultRandom().primaryKey(),
  swimlaneId: uuid("swimlane_id")
    .notNull()
    .references(() => tableSwimlanes.swimlaneId, { onDelete: "cascade" }),
  content: text("content").notNull(),
  status: varchar("status", { length: 50 }).notNull().default("todo"), // todo, in_progress, reopen, done, delay
  priority: varchar("priority", { length: 50 }).notNull().default("medium"), // low, medium, high
  detail: text("detail"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
