import { FastifyPluginAsync } from "fastify";
import { eq, and, sql, gte } from "drizzle-orm";
import { feedback, userAdmin, users } from "../../db/schema";
import { verifyAccessToken, AuthenticatedRequest } from "../auth/auth";
import {
  listFeedbackRouteSchema,
  createFeedbackRouteSchema,
  updateFeedbackRouteSchema,
  deleteFeedbackRouteSchema,
  adminListFeedbackRouteSchema,
  adminRespondFeedbackRouteSchema,
} from "./schemas";

const MAX_FEEDBACK_PER_USER_PER_DAY = 10;

/** Check if the given user ID is in user_admin (is admin) */
async function isAdmin(drizzleDb: any, userId: string): Promise<boolean> {
  const [row] = await drizzleDb
    .select({ adminId: userAdmin.adminId })
    .from(userAdmin)
    .where(eq(userAdmin.userId, userId))
    .limit(1);
  return !!row;
}

const feedbackRoutes: FastifyPluginAsync = async (fastify) => {
  // ---------- User routes (own feedback CRUD) ----------

  fastify.get(
    "/api/feedback",
    {
      schema: listFeedbackRouteSchema,
      preHandler: [verifyAccessToken],
    },
    async (request, reply) => {
      try {
        if (!fastify.drizzle) {
          return reply.status(500).send({ error: "Database not available" });
        }
        const authRequest = request as AuthenticatedRequest;
        if (!authRequest.user) {
          return reply.status(401).send({ error: "Unauthorized" });
        }
        const userId = authRequest.user.userId;

        const list = await fastify.drizzle
          .select({
            feedbackId: feedback.feedbackId,
            name: feedback.name,
            reason: feedback.reason,
            adminResponse: feedback.adminResponse,
            createdAt: feedback.createdAt,
            updatedAt: feedback.updatedAt,
          })
          .from(feedback)
          .where(eq(feedback.userId, userId))
          .orderBy(feedback.createdAt);

        return { data: list };
      } catch (error: any) {
        fastify.log.error({ err: error }, "Error listing feedback");
        return reply.status(500).send({
          error: process.env.NODE_ENV === "production" ? "Internal server error" : error.message,
        });
      }
    }
  );

  fastify.post(
    "/api/feedback",
    {
      schema: createFeedbackRouteSchema,
      preHandler: [verifyAccessToken],
    },
    async (request, reply) => {
      try {
        if (!fastify.drizzle) {
          return reply.status(500).send({ error: "Database not available" });
        }
        const authRequest = request as AuthenticatedRequest;
        if (!authRequest.user) {
          return reply.status(401).send({ error: "Unauthorized" });
        }
        const userId = authRequest.user.userId;
        const body = request.body as { name: string; reason: string };

        if (!body.name?.trim() || !body.reason?.trim()) {
          return reply.status(400).send({ error: "Name and reason are required" });
        }

        // Limit: max 10 feedback per user per day
        const todayStart = new Date();
        todayStart.setUTCHours(0, 0, 0, 0);
        const countResult = await fastify.drizzle
          .select({ count: sql<number>`count(*)::int` })
          .from(feedback)
          .where(
            and(
              eq(feedback.userId, userId),
              gte(feedback.createdAt, todayStart)
            )
          );
        const count = Number(countResult[0]?.count ?? 0);
        if (count >= MAX_FEEDBACK_PER_USER_PER_DAY) {
          return reply.status(400).send({
            error: `You can submit at most ${MAX_FEEDBACK_PER_USER_PER_DAY} feedback items per day. Try again tomorrow.`,
          });
        }

        const [created] = await fastify.drizzle
          .insert(feedback)
          .values({
            userId,
            name: body.name.trim(),
            reason: body.reason.trim(),
          })
          .returning();

        return reply.status(201).send({
          data: {
            feedbackId: created.feedbackId,
            name: created.name,
            reason: created.reason,
            adminResponse: created.adminResponse,
            createdAt: created.createdAt,
            updatedAt: created.updatedAt,
          },
        });
      } catch (error: any) {
        fastify.log.error({ err: error }, "Error creating feedback");
        return reply.status(500).send({
          error: process.env.NODE_ENV === "production" ? "Internal server error" : error.message,
        });
      }
    }
  );

  fastify.put(
    "/api/feedback/:feedbackId",
    {
      schema: updateFeedbackRouteSchema,
      preHandler: [verifyAccessToken],
    },
    async (request, reply) => {
      try {
        if (!fastify.drizzle) {
          return reply.status(500).send({ error: "Database not available" });
        }
        const authRequest = request as AuthenticatedRequest;
        if (!authRequest.user) {
          return reply.status(401).send({ error: "Unauthorized" });
        }
        const userId = authRequest.user.userId;
        const { feedbackId } = request.params as { feedbackId: string };
        const body = request.body as { name: string; reason: string };

        if (!body.name?.trim() || !body.reason?.trim()) {
          return reply.status(400).send({ error: "Name and reason are required" });
        }

        const [row] = await fastify.drizzle
          .select()
          .from(feedback)
          .where(eq(feedback.feedbackId, feedbackId))
          .limit(1);

        if (!row) {
          return reply.status(404).send({ error: "Feedback not found" });
        }
        if (row.userId !== userId) {
          return reply.status(403).send({ error: "You can only edit your own feedback" });
        }

        const [updated] = await fastify.drizzle
          .update(feedback)
          .set({
            name: body.name.trim(),
            reason: body.reason.trim(),
            updatedAt: new Date(),
          })
          .where(eq(feedback.feedbackId, feedbackId))
          .returning();

        return { data: updated };
      } catch (error: any) {
        fastify.log.error({ err: error }, "Error updating feedback");
        return reply.status(500).send({
          error: process.env.NODE_ENV === "production" ? "Internal server error" : error.message,
        });
      }
    }
  );

  fastify.delete(
    "/api/feedback/:feedbackId",
    {
      schema: deleteFeedbackRouteSchema,
      preHandler: [verifyAccessToken],
    },
    async (request, reply) => {
      try {
        if (!fastify.drizzle) {
          return reply.status(500).send({ error: "Database not available" });
        }
        const authRequest = request as AuthenticatedRequest;
        if (!authRequest.user) {
          return reply.status(401).send({ error: "Unauthorized" });
        }
        const userId = authRequest.user.userId;
        const { feedbackId } = request.params as { feedbackId: string };

        const [row] = await fastify.drizzle
          .select()
          .from(feedback)
          .where(eq(feedback.feedbackId, feedbackId))
          .limit(1);

        if (!row) {
          return reply.status(404).send({ error: "Feedback not found" });
        }
        if (row.userId !== userId) {
          return reply.status(403).send({ error: "You can only delete your own feedback" });
        }

        await fastify.drizzle.delete(feedback).where(eq(feedback.feedbackId, feedbackId));
        return { message: "Feedback deleted" };
      } catch (error: any) {
        fastify.log.error({ err: error }, "Error deleting feedback");
        return reply.status(500).send({
          error: process.env.NODE_ENV === "production" ? "Internal server error" : error.message,
        });
      }
    }
  );

  // ---------- Admin routes (view all + respond) ----------

  fastify.get(
    "/api/admin/feedback",
    {
      schema: adminListFeedbackRouteSchema,
      preHandler: [verifyAccessToken],
    },
    async (request, reply) => {
      try {
        if (!fastify.drizzle) {
          return reply.status(500).send({ error: "Database not available" });
        }
        const authRequest = request as AuthenticatedRequest;
        if (!authRequest.user) {
          return reply.status(401).send({ error: "Unauthorized" });
        }
        const isAdminUser = await isAdmin(fastify.drizzle, authRequest.user.userId);
        if (!isAdminUser) {
          return reply.status(403).send({ error: "Admin only" });
        }

        const list = await fastify.drizzle
          .select({
            feedbackId: feedback.feedbackId,
            name: feedback.name,
            reason: feedback.reason,
            userId: feedback.userId,
            userEmail: users.email,
            adminResponse: feedback.adminResponse,
            adminUserId: feedback.adminUserId,
            createdAt: feedback.createdAt,
            updatedAt: feedback.updatedAt,
          })
          .from(feedback)
          .innerJoin(users, eq(feedback.userId, users.userId))
          .orderBy(feedback.createdAt);

        return { data: list };
      } catch (error: any) {
        fastify.log.error({ err: error }, "Error listing admin feedback");
        return reply.status(500).send({
          error: process.env.NODE_ENV === "production" ? "Internal server error" : error.message,
        });
      }
    }
  );

  fastify.patch(
    "/api/admin/feedback/:feedbackId",
    {
      schema: adminRespondFeedbackRouteSchema,
      preHandler: [verifyAccessToken],
    },
    async (request, reply) => {
      try {
        if (!fastify.drizzle) {
          return reply.status(500).send({ error: "Database not available" });
        }
        const authRequest = request as AuthenticatedRequest;
        if (!authRequest.user) {
          return reply.status(401).send({ error: "Unauthorized" });
        }
        const isAdminUser = await isAdmin(fastify.drizzle, authRequest.user.userId);
        if (!isAdminUser) {
          return reply.status(403).send({ error: "Admin only" });
        }

        const [adminRow] = await fastify.drizzle
          .select({ adminId: userAdmin.adminId })
          .from(userAdmin)
          .where(eq(userAdmin.userId, authRequest.user.userId))
          .limit(1);
        const adminUserId = adminRow?.adminId ?? null;

        const { feedbackId } = request.params as { feedbackId: string };
        const body = request.body as { adminResponse: string };

        const [updated] = await fastify.drizzle
          .update(feedback)
          .set({
            adminResponse: body.adminResponse ?? null,
            adminUserId: adminUserId ?? undefined,
            updatedAt: new Date(),
          })
          .where(eq(feedback.feedbackId, feedbackId))
          .returning();

        if (!updated) {
          return reply.status(404).send({ error: "Feedback not found" });
        }
        return { data: updated };
      } catch (error: any) {
        fastify.log.error({ err: error }, "Error responding to feedback");
        return reply.status(500).send({
          error: process.env.NODE_ENV === "production" ? "Internal server error" : error.message,
        });
      }
    }
  );
};

export default feedbackRoutes;
