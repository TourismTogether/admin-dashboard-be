import { FastifyPluginAsync } from "fastify";
import { and, eq, desc, isNull } from "drizzle-orm";
import {
  meetings,
  meetingParticipants,
  meetingChats,
  meetingRecordings,
} from "../../db/schema";
import { verifyAccessToken, AuthenticatedRequest } from "../auth/auth";

function generateMeetingCode(): string {
  return Math.random().toString(36).substring(2, 15).toUpperCase();
}

const meetingRoutes: FastifyPluginAsync = async (fastify) => {
  // Create a new meeting
  fastify.post(
    "/api/meetings/create",
    {
      preHandler: [verifyAccessToken],
    },
    async (request, reply) => {
      const authRequest = request as AuthenticatedRequest;
      if (!authRequest.user) {
        return reply.code(401).send({ error: "Unauthorized" });
      }

      if (!fastify.drizzle) {
        return reply.code(500).send({ error: "Database not available" });
      }

      const { groupTaskId, groupId, title, description } = request.body as {
        groupTaskId: string;
        groupId: string;
        title: string;
        description?: string;
      };
      const userId = authRequest.user.userId;

      try {
        const meetingCode = generateMeetingCode();

        const [newMeeting] = await fastify.drizzle
          .insert(meetings)
          .values({
            groupTaskId,
            groupId,
            createdBy: userId,
            meetingCode,
            title,
            description: description || null,
            startTime: new Date(),
          })
          .returning();

        // Add creator as first participant
        await fastify.drizzle.insert(meetingParticipants).values({
          meetingId: newMeeting.meetingId,
          userId,
          isMicOn: true,
          isCameraOn: true,
        });

        reply.code(201).send({
          success: true,
          data: newMeeting,
        });
      } catch (error) {
        fastify.log.error(error);
        reply.code(500).send({
          success: false,
          message: "Failed to create meeting",
        });
      }
    }
  );

  // Get meeting details
  fastify.get(
    "/api/meetings/:meetingId",
    {
      preHandler: [verifyAccessToken],
    },
    async (request, reply) => {
      if (!fastify.drizzle) {
        return reply.code(500).send({ error: "Database not available" });
      }

      const { meetingId } = request.params as { meetingId: string };

      try {
        const [meeting] = await fastify.drizzle
          .select()
          .from(meetings)
          .where(eq(meetings.meetingId, meetingId));

        if (!meeting) {
          return reply.code(404).send({
            success: false,
            message: "Meeting not found",
          });
        }

        // Get participants
        const meetingParticipantsList = await fastify.drizzle
          .select()
          .from(meetingParticipants)
          .where(eq(meetingParticipants.meetingId, meetingId));

        reply.send({
          success: true,
          data: {
            ...meeting,
            participants: meetingParticipantsList,
          },
        });
      } catch (error) {
        fastify.log.error(error);
        reply.code(500).send({
          success: false,
          message: "Failed to fetch meeting",
        });
      }
    }
  );

  // Join meeting by code
  fastify.post<{ Body: { meetingCode: string } }>(
    "/api/meetings/join",
    {
      preHandler: [verifyAccessToken],
    },
    async (request, reply) => {
      const authRequest = request as AuthenticatedRequest;
      if (!authRequest.user) {
        return reply.code(401).send({ error: "Unauthorized" });
      }
      const { meetingCode } = request.body;
      const userId = authRequest.user.userId;

      if (!fastify.drizzle) {
        return reply.code(500).send({ error: "Database not available" });
      }

      try {
        const [meeting] = await fastify.drizzle
          .select()
          .from(meetings)
          .where(eq(meetings.meetingCode, meetingCode));

        if (!meeting) {
          return reply.code(404).send({
            success: false,
            message: "Meeting not found",
          });
        }

        // Check if user is already a participant
        const [existingParticipant] = await fastify.drizzle
          .select()
          .from(meetingParticipants)
          .where(
            and(
              eq(meetingParticipants.meetingId, meeting.meetingId),
              eq(meetingParticipants.userId, userId)
            )
          );

        if (!existingParticipant) {
          await fastify.drizzle.insert(meetingParticipants).values({
            meetingId: meeting.meetingId,
            userId,
            isMicOn: true,
            isCameraOn: true,
          });
        }

        reply.send({
          success: true,
          data: meeting,
        });
      } catch (error) {
        fastify.log.error(error);
        reply.code(500).send({
          success: false,
          message: "Failed to join meeting",
        });
      }
    }
  );

  // Update participant media status
  fastify.patch<{ Params: { meetingId: string }; Body: { isMicOn?: boolean; isCameraOn?: boolean } }>(
    "/api/meetings/:meetingId/controls",
    {
      preHandler: [verifyAccessToken],
    },
    async (request, reply) => {
      const authRequest = request as AuthenticatedRequest;
      if (!authRequest.user) {
        return reply.code(401).send({ error: "Unauthorized" });
      }
      const { meetingId } = request.params as { meetingId: string };
      const { isMicOn, isCameraOn } = request.body as {
        isMicOn?: boolean;
        isCameraOn?: boolean;
      };
      const userId = authRequest.user.userId;

      if (!fastify.drizzle) {
        return reply.code(500).send({ error: "Database not available" });
      }

      try {
        const [updatedParticipant] = await fastify.drizzle
          .update(meetingParticipants)
          .set({
            ...(isMicOn !== undefined && { isMicOn }),
            ...(isCameraOn !== undefined && { isCameraOn }),
          })
          .where(
            and(
              eq(meetingParticipants.meetingId, meetingId),
              eq(meetingParticipants.userId, userId)
            )
          )
          .returning();

        reply.send({
          success: true,
          data: updatedParticipant,
        });
      } catch (error) {
        fastify.log.error(error);
        reply.code(500).send({
          success: false,
          message: "Failed to update controls",
        });
      }
    }
  );

  // Get meeting chat messages
  fastify.get<{ Params: { meetingId: string } }>(
    "/api/meetings/:meetingId/chats",
    {
      preHandler: [verifyAccessToken],
    },
    async (request, reply) => {
      if (!fastify.drizzle) {
        return reply.code(500).send({ error: "Database not available" });
      }

      const { meetingId } = request.params;

      try {
        const chats = await fastify.drizzle
          .select()
          .from(meetingChats)
          .where(eq(meetingChats.meetingId, meetingId));

        reply.send({
          success: true,
          data: chats,
        });
      } catch (error) {
        fastify.log.error(error);
        reply.code(500).send({
          success: false,
          message: "Failed to fetch chats",
        });
      }
    }
  );

  // Send chat message
  fastify.post<{ Params: { meetingId: string }; Body: { message: string } }>(
    "/api/meetings/:meetingId/chats",
    {
      preHandler: [verifyAccessToken],
    },
    async (request, reply) => {
      const authRequest = request as AuthenticatedRequest;
      if (!authRequest.user) {
        return reply.code(401).send({ error: "Unauthorized" });
      }
      const { meetingId } = request.params as { meetingId: string };
      const { message } = request.body as { message: string };
      const userId = authRequest.user.userId;

      if (!fastify.drizzle) {
        return reply.code(500).send({ error: "Database not available" });
      }

      try {
        const [newChat] = await fastify.drizzle
          .insert(meetingChats)
          .values({
            meetingId,
            userId,
            message,
          })
          .returning();

        reply.code(201).send({
          success: true,
          data: newChat,
        });
      } catch (error) {
        fastify.log.error(error);
        reply.code(500).send({
          success: false,
          message: "Failed to send message",
        });
      }
    }
  );

  // Leave meeting
  fastify.post<{ Params: { meetingId: string } }>(
    "/api/meetings/:meetingId/leave",
    {
      preHandler: [verifyAccessToken],
    },
    async (request, reply) => {
      const authRequest = request as AuthenticatedRequest;
      if (!authRequest.user) {
        return reply.code(401).send({ error: "Unauthorized" });
      }
      const { meetingId } = request.params as { meetingId: string };
      const userId = authRequest.user.userId;

      if (!fastify.drizzle) {
        return reply.code(500).send({ error: "Database not available" });
      }

      try {
        await fastify.drizzle
          .update(meetingParticipants)
          .set({ leftAt: new Date() })
          .where(
            and(
              eq(meetingParticipants.meetingId, meetingId),
              eq(meetingParticipants.userId, userId)
            )
          );

        // Check if there are any active participants
        const activeParticipants = await fastify.drizzle
          .select()
          .from(meetingParticipants)
          .where(
            and(
              eq(meetingParticipants.meetingId, meetingId),
              isNull(meetingParticipants.leftAt)
            )
          );

        // If no active participants, end the meeting
        if (activeParticipants.length === 0) {
          await fastify.drizzle
            .update(meetings)
            .set({ isActive: false, endTime: new Date() })
            .where(eq(meetings.meetingId, meetingId));
        }

        reply.send({
          success: true,
          message: "Left meeting successfully",
        });
      } catch (error) {
        fastify.log.error(error);
        reply.code(500).send({
          success: false,
          message: "Failed to leave meeting",
        });
      }
    }
  );

  // Save meeting recording metadata
  fastify.post<{
    Params: { meetingId: string };
    Body: { storagePath: string; duration?: number; size?: number; status?: string };
  }>(
    "/api/meetings/:meetingId/recordings",
    {
      preHandler: [verifyAccessToken],
    },
    async (request, reply) => {
      const authRequest = request as AuthenticatedRequest;
      if (!authRequest.user) {
        return reply.code(401).send({ error: "Unauthorized" });
      }
      if (!fastify.drizzle) {
        return reply.code(500).send({ error: "Database not available" });
      }

      const { meetingId } = request.params as { meetingId: string };
      const { storagePath, duration, size, status } = request.body as {
        storagePath: string;
        duration?: number;
        size?: number;
        status?: string;
      };

      if (!storagePath?.trim()) {
        return reply.code(400).send({ error: "storagePath is required" });
      }

      try {
        const [meeting] = await fastify.drizzle
          .select()
          .from(meetings)
          .where(eq(meetings.meetingId, meetingId));

        if (!meeting) {
          return reply.code(404).send({ error: "Meeting not found" });
        }

        const [recording] = await fastify.drizzle
          .insert(meetingRecordings)
          .values({
            meetingId,
            storagePath,
            duration: duration ?? null,
            size: size ?? null,
            status: status ?? "ready",
          })
          .returning();

        return reply.code(201).send({
          success: true,
          data: recording,
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          message: "Failed to save recording metadata",
        });
      }
    }
  );

  // Get recordings for a meeting
  fastify.get<{ Params: { meetingId: string } }>(
    "/api/meetings/:meetingId/recordings",
    {
      preHandler: [verifyAccessToken],
    },
    async (request, reply) => {
      if (!fastify.drizzle) {
        return reply.code(500).send({ error: "Database not available" });
      }

      const { meetingId } = request.params as { meetingId: string };

      try {
        const recordings = await fastify.drizzle
          .select()
          .from(meetingRecordings)
          .where(eq(meetingRecordings.meetingId, meetingId))
          .orderBy(desc(meetingRecordings.createdAt));

        return reply.send({
          success: true,
          data: recordings,
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          message: "Failed to fetch recordings",
        });
      }
    }
  );

  // Get group meetings
  fastify.get<{ Params: { groupId: string } }>(
    "/api/groups/:groupId/meetings",
    {
      preHandler: [verifyAccessToken],
    },
    async (request, reply) => {
      if (!fastify.drizzle) {
        return reply.code(500).send({ error: "Database not available" });
      }

      const { groupId } = request.params;

      try {
        const groupMeetings = await fastify.drizzle
          .select()
          .from(meetings)
          .where(eq(meetings.groupId, groupId))
          .orderBy(desc(meetings.createdAt));

        reply.send({
          success: true,
          data: groupMeetings,
        });
      } catch (error) {
        fastify.log.error(error);
        reply.code(500).send({
          success: false,
          message: "Failed to fetch meetings",
        });
      }
    }
  );
};

export default meetingRoutes;
