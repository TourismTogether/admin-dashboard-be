import { pgTable, uuid, boolean, timestamp, varchar } from "drizzle-orm/pg-core";
import { tableWeeks } from "./tableWeeks";
import { users } from "./users";

export const shareTable = pgTable("share_table", {
  id: uuid("id").defaultRandom().primaryKey(),
  tableId: uuid("table_id")
    .notNull()
    .references(() => tableWeeks.tableId, { onDelete: "cascade" }),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.userId, { onDelete: "cascade" }),
  shareId: varchar("share_id", { length: 64 }).notNull().unique(),
  isPublic: boolean("is_public").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
