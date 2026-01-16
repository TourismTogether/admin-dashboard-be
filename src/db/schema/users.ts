import { pgTable, uuid, varchar, text, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  userId: uuid("user_id").defaultRandom().primaryKey(),
  account: varchar("account", { length: 255 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(), // Hashed password
  email: varchar("email", { length: 255 }).notNull().unique(),
  nickname: varchar("nickname", { length: 255 }),
  fullname: varchar("fullname", { length: 255 }),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
