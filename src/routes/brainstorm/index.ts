import { FastifyPluginAsync } from "fastify";
import { eq, and, desc } from "drizzle-orm";
import { brainstorm } from "../../db/schema";
import { verifyAccessToken, AuthenticatedRequest } from "../auth/auth";
import {
  getBrainstormsRouteSchema,
  getBrainstormRouteSchema,
  createBrainstormRouteSchema,
  updateBrainstormRouteSchema,
  deleteBrainstormRouteSchema,
} from "./schemas";

const brainstormRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/api/brainstorm",
    {
      schema: getBrainstormsRouteSchema,
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
        const items = await fastify.drizzle
          .select()
          .from(brainstorm)
          .where(eq(brainstorm.userId, userId))
          .orderBy(desc(brainstorm.updatedAt));
        return { data: items };
      } catch (error: unknown) {
        const err = error as Error;
        fastify.log.error({ err }, "Error fetching brainstorms");
        return reply.status(500).send({ error: err.message });
      }
    }
  );

  fastify.get(
    "/api/brainstorm/:id",
    {
      schema: getBrainstormRouteSchema,
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
        const { id } = request.params as { id: string };
        const [item] = await fastify.drizzle
          .select()
          .from(brainstorm)
          .where(and(eq(brainstorm.id, id), eq(brainstorm.userId, userId)))
          .limit(1);
        if (!item) {
          return reply.status(404).send({ error: "Brainstorm not found" });
        }
        return { data: item };
      } catch (error: unknown) {
        const err = error as Error;
        fastify.log.error({ err }, "Error fetching brainstorm");
        return reply.status(500).send({ error: err.message });
      }
    }
  );

  fastify.post(
    "/api/brainstorm",
    {
      schema: createBrainstormRouteSchema,
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
        const body = request.body as {
          name?: string;
          type: string;
          content: string;
        };
        const [created] = await fastify.drizzle
          .insert(brainstorm)
          .values({
            userId,
            name: body.name?.trim() || "Untitled",
            type: body.type,
            content: body.content,
          })
          .returning();
        return { data: created };
      } catch (error: unknown) {
        const err = error as Error;
        fastify.log.error({ err }, "Error creating brainstorm");
        return reply.status(500).send({ error: err.message });
      }
    }
  );

  fastify.put(
    "/api/brainstorm/:id",
    {
      schema: updateBrainstormRouteSchema,
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
        const { id } = request.params as { id: string };
        const body = request.body as {
          name?: string;
          type?: string;
          content?: string;
        };
        const [existing] = await fastify.drizzle
          .select()
          .from(brainstorm)
          .where(and(eq(brainstorm.id, id), eq(brainstorm.userId, userId)))
          .limit(1);
        if (!existing) {
          return reply.status(404).send({ error: "Brainstorm not found" });
        }
        const [updated] = await fastify.drizzle
          .update(brainstorm)
          .set({
            ...(body.name !== undefined && {
              name: (body.name?.trim() ?? "") || "Untitled",
            }),
            ...(body.type !== undefined && { type: body.type }),
            ...(body.content !== undefined && { content: body.content }),
            updatedAt: new Date(),
          })
          .where(eq(brainstorm.id, id))
          .returning();
        return { data: updated };
      } catch (error: unknown) {
        const err = error as Error;
        fastify.log.error({ err }, "Error updating brainstorm");
        return reply.status(500).send({ error: err.message });
      }
    }
  );

  fastify.delete(
    "/api/brainstorm/:id",
    {
      schema: deleteBrainstormRouteSchema,
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
        const { id } = request.params as { id: string };
        const [existing] = await fastify.drizzle
          .select()
          .from(brainstorm)
          .where(and(eq(brainstorm.id, id), eq(brainstorm.userId, userId)))
          .limit(1);
        if (!existing) {
          return reply.status(404).send({ error: "Brainstorm not found" });
        }
        await fastify.drizzle.delete(brainstorm).where(eq(brainstorm.id, id));
        return { message: "Brainstorm deleted successfully" };
      } catch (error: unknown) {
        const err = error as Error;
        fastify.log.error({ err }, "Error deleting brainstorm");
        return reply.status(500).send({ error: err.message });
      }
    }
  );
};

export default brainstormRoutes;
