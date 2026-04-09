import { z } from "zod";

export const createMeetingSchema = z.object({
  groupTaskId: z.string().min(1),
  groupId: z.string().min(1),
  title: z.string().min(1).max(255),
  description: z.string().optional(),
});

export const joinMeetingSchema = z.object({
  meetingCode: z.string().min(1),
});

export const sendMessageSchema = z.object({
  message: z.string().min(1).max(1000),
});

export const meetingControlsSchema = z.object({
  isMicOn: z.boolean().optional(),
  isCameraOn: z.boolean().optional(),
});

export type CreateMeetingInput = z.infer<typeof createMeetingSchema>;
export type JoinMeetingInput = z.infer<typeof joinMeetingSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type MeetingControlsInput = z.infer<typeof meetingControlsSchema>;
