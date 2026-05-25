import { pgTable, uuid, varchar, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { users } from "./users";

export type ResearchSource = {
  title: string;
  link: string;
  snippet: string;
  position: number;
  date?: string;
};

export const researchConversations = pgTable("research_conversations", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.userId, { onDelete: "cascade" }),
  title: varchar("title", { length: 500 }).notNull().default("Untitled research"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const researchMessages = pgTable("research_messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  conversationId: uuid("conversation_id")
    .notNull()
    .references(() => researchConversations.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 20 }).notNull(),
  content: text("content").notNull(),
  sources: jsonb("sources").$type<ResearchSource[]>().notNull().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
