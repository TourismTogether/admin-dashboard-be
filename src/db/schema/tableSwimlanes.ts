import { pgTable, uuid, text, time, integer, timestamp } from "drizzle-orm/pg-core";
import { tableWeeks } from "./tableWeeks";

export const tableSwimlanes = pgTable("table_swimlanes", {
  swimlaneId: uuid("swimlane_id").defaultRandom().primaryKey(),
  tableId: uuid("table_id")
    .notNull()
    .references(() => tableWeeks.tableId, { onDelete: "cascade" }),
  content: text("content").notNull(),
  startTime: time("start_time"),
  duration: integer("duration"), // Duration in minutes
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
