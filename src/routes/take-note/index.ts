import { FastifyPluginAsync } from "fastify";
import { eq, and, desc } from "drizzle-orm";
import { takeNote } from "../../db/schema";
import { verifyAccessToken, AuthenticatedRequest } from "../auth/auth";
import {
  getTakeNotesRouteSchema,
  getTakeNoteRouteSchema,
  createTakeNoteRouteSchema,
  updateTakeNoteRouteSchema,
  deleteTakeNoteRouteSchema,
} from "./schemas";

const takeNoteRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/api/take-note",
    {
      schema: getTakeNotesRouteSchema,
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
          .from(takeNote)
          .where(eq(takeNote.userId, userId))
          .orderBy(desc(takeNote.updatedAt));
        return { data: items };
      } catch (error: unknown) {
        const err = error as Error;
        fastify.log.error({ err }, "Error fetching take notes");
        return reply.status(500).send({ error: err.message });
      }
    },
  );

  fastify.get(
    "/api/take-note/:id",
    {
      schema: getTakeNoteRouteSchema,
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
          .from(takeNote)
          .where(and(eq(takeNote.id, id), eq(takeNote.userId, userId)))
          .limit(1);
        if (!item) {
          return reply.status(404).send({ error: "Note not found" });
        }
        return { data: item };
      } catch (error: unknown) {
        const err = error as Error;
        fastify.log.error({ err }, "Error fetching take note");
        return reply.status(500).send({ error: err.message });
      }
    },
  );

  fastify.post(
    "/api/take-note",
    {
      schema: createTakeNoteRouteSchema,
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
          title?: string;
          content?: string;
        };
        const [created] = await fastify.drizzle
          .insert(takeNote)
          .values({
            userId,
            title: body.title?.trim() || "Untitled",
            content: body.content ?? "",
          })
          .returning();
        return { data: created };
      } catch (error: unknown) {
        const err = error as Error;
        fastify.log.error({ err }, "Error creating take note");
        return reply.status(500).send({ error: err.message });
      }
    },
  );

  fastify.put(
    "/api/take-note/:id",
    {
      schema: updateTakeNoteRouteSchema,
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
          title?: string;
          content?: string;
        };
        const [existing] = await fastify.drizzle
          .select()
          .from(takeNote)
          .where(and(eq(takeNote.id, id), eq(takeNote.userId, userId)))
          .limit(1);
        if (!existing) {
          return reply.status(404).send({ error: "Note not found" });
        }
        const [updated] = await fastify.drizzle
          .update(takeNote)
          .set({
            ...(body.title !== undefined && {
              title: (body.title?.trim() ?? "") || "Untitled",
            }),
            ...(body.content !== undefined && { content: body.content }),
            updatedAt: new Date(),
          })
          .where(eq(takeNote.id, id))
          .returning();
        return { data: updated };
      } catch (error: unknown) {
        const err = error as Error;
        fastify.log.error({ err }, "Error updating take note");
        return reply.status(500).send({ error: err.message });
      }
    },
  );

  fastify.delete(
    "/api/take-note/:id",
    {
      schema: deleteTakeNoteRouteSchema,
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
          .from(takeNote)
          .where(and(eq(takeNote.id, id), eq(takeNote.userId, userId)))
          .limit(1);
        if (!existing) {
          return reply.status(404).send({ error: "Note not found" });
        }
        await fastify.drizzle.delete(takeNote).where(eq(takeNote.id, id));
        return { message: "Note deleted successfully" };
      } catch (error: unknown) {
        const err = error as Error;
        fastify.log.error({ err }, "Error deleting take note");
        return reply.status(500).send({ error: err.message });
      }
    },
  );
};

export default takeNoteRoutes;
