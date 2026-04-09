import { FastifyPluginAsync } from "fastify";
import { desc, eq } from "drizzle-orm";
import { events, userAdmin } from "../../db/schema";
import { verifyAccessToken, AuthenticatedRequest } from "../auth/auth";
import {
  listEventsRouteSchema,
  createEventRouteSchema,
  updateEventRouteSchema,
  deleteEventRouteSchema,
} from "./schemas";

type EventStatus = "active" | "inactive" | "soon";

const normalizeStatus = (value?: string | null): EventStatus => {
  if (value === "active" || value === "inactive" || value === "soon") return value;
  return "soon";
};

async function isAdmin(drizzleDb: any, userId: string): Promise<boolean> {
  const [row] = await drizzleDb
    .select({ adminId: userAdmin.adminId })
    .from(userAdmin)
    .where(eq(userAdmin.userId, userId))
    .limit(1);
  return !!row;
}

const eventRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/api/events",
    {
      schema: listEventsRouteSchema,
      preHandler: [verifyAccessToken],
    },
    async (request, reply) => {
      try {
        if (!fastify.drizzle) {
          return reply.status(500).send({ error: "Database not available" });
        }
        const list = await fastify.drizzle.select().from(events).orderBy(desc(events.createdAt));
        return { data: list };
      } catch (error: any) {
        fastify.log.error({ err: error }, "Error listing events");
        return reply.status(500).send({
          error: process.env.NODE_ENV === "production" ? "Internal server error" : error.message,
        });
      }
    },
  );

  fastify.post(
    "/api/admin/events",
    {
      schema: createEventRouteSchema,
      preHandler: [verifyAccessToken],
    },
    async (request, reply) => {
      try {
        if (!fastify.drizzle) {
          return reply.status(500).send({ error: "Database not available" });
        }
        const authRequest = request as AuthenticatedRequest;
        if (!authRequest.user) return reply.status(401).send({ error: "Unauthorized" });

        const admin = await isAdmin(fastify.drizzle, authRequest.user.userId);
        if (!admin) return reply.status(403).send({ error: "Admin only" });

        const body = request.body as {
          title: string;
          description?: string | null;
          detail?: string | null;
          eventLink?: string | null;
          type?: string;
          location?: string | null;
          startsAt?: string | null;
          endsAt?: string | null;
          status?: EventStatus;
        };
        const status = normalizeStatus(body.status);

        const [created] = await fastify.drizzle
          .insert(events)
          .values({
            title: body.title.trim(),
            description: body.description ?? null,
            detail: body.detail ?? null,
            eventLink: body.eventLink ?? null,
            type: body.type?.trim() || "general",
            location: body.location ?? null,
            startsAt: body.startsAt ? new Date(body.startsAt) : null,
            endsAt: body.endsAt ? new Date(body.endsAt) : null,
            status,
            isActive: status === "active",
            createdBy: authRequest.user.userId,
          })
          .returning();

        return reply.status(201).send({ data: created });
      } catch (error: any) {
        fastify.log.error({ err: error }, "Error creating event");
        return reply.status(500).send({
          error: process.env.NODE_ENV === "production" ? "Internal server error" : error.message,
        });
      }
    },
  );

  fastify.put(
    "/api/admin/events/:eventId",
    {
      schema: updateEventRouteSchema,
      preHandler: [verifyAccessToken],
    },
    async (request, reply) => {
      try {
        if (!fastify.drizzle) {
          return reply.status(500).send({ error: "Database not available" });
        }
        const authRequest = request as AuthenticatedRequest;
        if (!authRequest.user) return reply.status(401).send({ error: "Unauthorized" });

        const admin = await isAdmin(fastify.drizzle, authRequest.user.userId);
        if (!admin) return reply.status(403).send({ error: "Admin only" });

        const { eventId } = request.params as { eventId: string };
        const body = request.body as {
          title?: string;
          description?: string | null;
          detail?: string | null;
          eventLink?: string | null;
          type?: string;
          location?: string | null;
          startsAt?: string | null;
          endsAt?: string | null;
          status?: EventStatus;
        };
        const normalizedStatus =
          body.status !== undefined ? normalizeStatus(body.status) : undefined;

        const [updated] = await fastify.drizzle
          .update(events)
          .set({
            ...(body.title !== undefined ? { title: body.title.trim() } : {}),
            ...(body.description !== undefined ? { description: body.description } : {}),
            ...(body.detail !== undefined ? { detail: body.detail } : {}),
            ...(body.eventLink !== undefined ? { eventLink: body.eventLink } : {}),
            ...(body.type !== undefined ? { type: body.type.trim() || "general" } : {}),
            ...(body.location !== undefined ? { location: body.location } : {}),
            ...(body.startsAt !== undefined
              ? { startsAt: body.startsAt ? new Date(body.startsAt) : null }
              : {}),
            ...(body.endsAt !== undefined ? { endsAt: body.endsAt ? new Date(body.endsAt) : null } : {}),
            ...(normalizedStatus !== undefined
              ? {
                  status: normalizedStatus,
                  isActive: normalizedStatus === "active",
                }
              : {}),
            updatedAt: new Date(),
          })
          .where(eq(events.eventId, eventId))
          .returning();

        if (!updated) return reply.status(404).send({ error: "Event not found" });
        return { data: updated };
      } catch (error: any) {
        fastify.log.error({ err: error }, "Error updating event");
        return reply.status(500).send({
          error: process.env.NODE_ENV === "production" ? "Internal server error" : error.message,
        });
      }
    },
  );

  fastify.delete(
    "/api/admin/events/:eventId",
    {
      schema: deleteEventRouteSchema,
      preHandler: [verifyAccessToken],
    },
    async (request, reply) => {
      try {
        if (!fastify.drizzle) {
          return reply.status(500).send({ error: "Database not available" });
        }
        const authRequest = request as AuthenticatedRequest;
        if (!authRequest.user) return reply.status(401).send({ error: "Unauthorized" });

        const admin = await isAdmin(fastify.drizzle, authRequest.user.userId);
        if (!admin) return reply.status(403).send({ error: "Admin only" });

        const { eventId } = request.params as { eventId: string };
        const [deleted] = await fastify.drizzle
          .delete(events)
          .where(eq(events.eventId, eventId))
          .returning({ eventId: events.eventId });
        if (!deleted) return reply.status(404).send({ error: "Event not found" });
        return { message: "Event deleted" };
      } catch (error: any) {
        fastify.log.error({ err: error }, "Error deleting event");
        return reply.status(500).send({
          error: process.env.NODE_ENV === "production" ? "Internal server error" : error.message,
        });
      }
    },
  );
};

export default eventRoutes;
