import { pgTable, text, timestamp, uuid, boolean, varchar, integer } from "drizzle-orm/pg-core";
import { groups } from "./groups";
import { users } from "./users";
import { relations } from "drizzle-orm";

export const meetings = pgTable("meetings", {
  meetingId: uuid("meeting_id").primaryKey().defaultRandom(),
  groupTaskId: varchar("group_task_id").notNull(),
  groupId: uuid("group_id")
    .notNull()
    .references(() => groups.groupId, { onDelete: "cascade" }),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.userId, { onDelete: "cascade" }),
  meetingCode: varchar("meeting_code").notNull().unique(), // unique code for joining
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  startTime: timestamp("start_time", { withTimezone: true }),
  endTime: timestamp("end_time", { withTimezone: true }),
  recordingUrl: text("recording_url"),
  recordingSize: integer("recording_size"), // in bytes
  maxParticipants: integer("max_participants").default(100),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const meetingParticipants = pgTable("meeting_participants", {
  participantId: uuid("participant_id").primaryKey().defaultRandom(),
  meetingId: uuid("meeting_id")
    .notNull()
    .references(() => meetings.meetingId, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.userId, { onDelete: "cascade" }),
  joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow(),
  leftAt: timestamp("left_at", { withTimezone: true }),
  isMicOn: boolean("is_mic_on").default(true),
  isCameraOn: boolean("is_camera_on").default(true),
  isPresenting: boolean("is_presenting").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const meetingChats = pgTable("meeting_chats", {
  chatId: uuid("chat_id").primaryKey().defaultRandom(),
  meetingId: uuid("meeting_id")
    .notNull()
    .references(() => meetings.meetingId, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.userId, { onDelete: "cascade" }),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const meetingRecordings = pgTable("meeting_recordings", {
  recordingId: uuid("recording_id").primaryKey().defaultRandom(),
  meetingId: uuid("meeting_id")
    .notNull()
    .references(() => meetings.meetingId, { onDelete: "cascade" }),
  storagePath: text("storage_path").notNull(),
  duration: integer("duration"), // in seconds
  size: integer("size"), // in bytes
  status: varchar("status", { length: 50 }).default("processing"), // processing, ready, failed
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// Relations
export const meetingsRelations = relations(meetings, ({ one, many }) => ({
  group: one(groups, {
    fields: [meetings.groupId],
    references: [groups.groupId],
  }),
  creator: one(users, {
    fields: [meetings.createdBy],
    references: [users.userId],
  }),
  participants: many(meetingParticipants),
  chats: many(meetingChats),
  recordings: many(meetingRecordings),
}));

export const meetingParticipantsRelations = relations(
  meetingParticipants,
  ({ one }) => ({
    meeting: one(meetings, {
      fields: [meetingParticipants.meetingId],
      references: [meetings.meetingId],
    }),
    user: one(users, {
      fields: [meetingParticipants.userId],
      references: [users.userId],
    }),
  })
);

export const meetingChatsRelations = relations(meetingChats, ({ one }) => ({
  meeting: one(meetings, {
    fields: [meetingChats.meetingId],
    references: [meetings.meetingId],
  }),
  user: one(users, {
    fields: [meetingChats.userId],
    references: [users.userId],
  }),
}));

export const meetingRecordingsRelations = relations(
  meetingRecordings,
  ({ one }) => ({
    meeting: one(meetings, {
      fields: [meetingRecordings.meetingId],
      references: [meetings.meetingId],
    }),
  })
);
