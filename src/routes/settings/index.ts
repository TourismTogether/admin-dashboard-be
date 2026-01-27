import { FastifyPluginAsync } from "fastify";
import { and, eq } from "drizzle-orm";
import { userSettings, users } from "../../db/schema";
import { verifyAccessToken, AuthenticatedRequest } from "../auth/auth";
import {
  getPersonalTaskEmailSettingsSchema,
  updatePersonalTaskEmailSettingsSchema,
} from "./schemas";

const settingsRoutes: FastifyPluginAsync = async (fastify) => {
  // Get personal task email settings for current user
  fastify.get(
    "/api/settings/personal-tasks-email",
    {
      schema: getPersonalTaskEmailSettingsSchema,
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

        // Try to load settings
        const [setting] = await fastify.drizzle
          .select()
          .from(userSettings)
          .where(eq(userSettings.userId, userId))
          .limit(1);

        // Fallback email: user's account email
        let email: string | null = null;
        if (!setting || !setting.personalTasksEmail) {
          const [user] = await fastify.drizzle
            .select({ email: users.email })
            .from(users)
            .where(eq(users.userId, userId))
            .limit(1);
          email = user?.email ?? null;
        } else {
          email = setting.personalTasksEmail;
        }

        return {
          data: {
            sendPersonalTasksEmail: setting ? setting.sendPersonalTasksEmail : false,
            email,
          },
        };
      } catch (error: any) {
        fastify.log.error({ err: error }, "Error fetching personal task email settings");
        return reply.status(500).send({ error: error.message });
      }
    }
  );

  // Update personal task email settings for current user
  fastify.put(
    "/api/settings/personal-tasks-email",
    {
      schema: updatePersonalTaskEmailSettingsSchema,
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
          sendPersonalTasksEmail: boolean;
          email: string;
        };

        // Basic guard
        if (!body.email) {
          return reply.status(400).send({ error: "Email is required" });
        }

        // Upsert settings row
        const [existing] = await fastify.drizzle
          .select()
          .from(userSettings)
          .where(eq(userSettings.userId, userId))
          .limit(1);

        if (existing) {
          const [updated] = await fastify.drizzle
            .update(userSettings)
            .set({
              sendPersonalTasksEmail: body.sendPersonalTasksEmail,
              personalTasksEmail: body.email,
              updatedAt: new Date(),
            })
            .where(and(eq(userSettings.userId, userId)))
            .returning();

          return {
            data: {
              sendPersonalTasksEmail: updated.sendPersonalTasksEmail,
              email: updated.personalTasksEmail,
            },
          };
        } else {
          const [created] = await fastify.drizzle
            .insert(userSettings)
            .values({
              userId,
              sendPersonalTasksEmail: body.sendPersonalTasksEmail,
              personalTasksEmail: body.email,
            })
            .returning();

          return {
            data: {
              sendPersonalTasksEmail: created.sendPersonalTasksEmail,
              email: created.personalTasksEmail,
            },
          };
        }
      } catch (error: any) {
        fastify.log.error({ err: error }, "Error updating personal task email settings");
        return reply.status(500).send({ error: error.message });
      }
    }
  );
};

export default settingsRoutes;

