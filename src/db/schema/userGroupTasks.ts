import { pgTable, uuid, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { users } from "./users";
import { groupTasks } from "./groupTasks";

export const userGroupTasks = pgTable("user_group_tasks", {
  groupTaskId: uuid("group_task_id")
    .notNull()
    .references(() => groupTasks.groupTaskId, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.userId, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.groupTaskId, table.userId] }),
}));
