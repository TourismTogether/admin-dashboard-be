import { date, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";

export const personalLearningNotes = pgTable(
  "personal_learning_notes",
  {
    noteId: uuid("note_id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.userId, { onDelete: "cascade" }),
    noteDate: date("note_date").notNull(),
    content: text("content").notNull().default(""),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userDateUnique: unique("personal_learning_notes_user_id_note_date_unique").on(
      table.userId,
      table.noteDate,
    ),
  }),
);
