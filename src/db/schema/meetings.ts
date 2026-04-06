import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  boolean,
} from "drizzle-orm/pg-core";
import { groups } from "./groups";
import { users } from "./users";

export const meetings = pgTable("meetings", {
  meetingId: uuid("meeting_id").defaultRandom().primaryKey(),
  groupTaskId: varchar("group_task_id").notNull(),
  groupId: uuid("group_id")
    .notNull()
    .references(() => groups.groupId, { onDelete: "cascade" }),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.userId, { onDelete: "cascade" }),
  meetingCode: varchar("meeting_code").notNull().unique(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true).notNull(),
  startTime: timestamp("start_time", { withTimezone: true }),
  endTime: timestamp("end_time", { withTimezone: true }),
  recordingUrl: text("recording_url"),
  recordingSize: integer("recording_size"),
  maxParticipants: integer("max_participants").default(100).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const meetingParticipants = pgTable("meeting_participants", {
  participantId: uuid("participant_id").defaultRandom().primaryKey(),
  meetingId: uuid("meeting_id")
    .notNull()
    .references(() => meetings.meetingId, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.userId, { onDelete: "cascade" }),
  joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
  leftAt: timestamp("left_at", { withTimezone: true }),
  isMicOn: boolean("is_mic_on").default(true).notNull(),
  isCameraOn: boolean("is_camera_on").default(true).notNull(),
  isPresenting: boolean("is_presenting").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const meetingChats = pgTable("meeting_chats", {
  chatId: uuid("chat_id").defaultRandom().primaryKey(),
  meetingId: uuid("meeting_id")
    .notNull()
    .references(() => meetings.meetingId, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.userId, { onDelete: "cascade" }),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const meetingRecordings = pgTable("meeting_recordings", {
  recordingId: uuid("recording_id").defaultRandom().primaryKey(),
  meetingId: uuid("meeting_id")
    .notNull()
    .references(() => meetings.meetingId, { onDelete: "cascade" }),
  storagePath: text("storage_path").notNull(),
  duration: integer("duration"),
  size: integer("size"),
  status: varchar("status", { length: 50 }).default("processing").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
