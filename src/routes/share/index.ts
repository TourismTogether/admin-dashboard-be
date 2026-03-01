import { FastifyPluginAsync } from "fastify";
import { eq, and, inArray } from "drizzle-orm";
import { tableWeeks, tableSwimlanes, personalTasks, shareTable } from "../../db/schema";
import { verifyAccessToken, AuthenticatedRequest } from "../auth/auth";

const shareRoutes: FastifyPluginAsync = async (fastify) => {
  // Get shared table by shareId (public: no auth required; if auth, returns isOwner)
  fastify.get(
    "/api/share/table/:shareId",
    async (request, reply) => {
      try {
        if (!fastify.drizzle) {
          return reply.status(500).send({ error: "Database not available" });
        }
        const { shareId } = request.params as { shareId: string };

        const [share] = await fastify.drizzle
          .select()
          .from(shareTable)
          .where(eq(shareTable.shareId, shareId))
          .limit(1);
        if (!share || !share.isPublic) {
          return reply.status(404).send({ error: "Share not found or link is disabled" });
        }

        const [table] = await fastify.drizzle
          .select()
          .from(tableWeeks)
          .where(eq(tableWeeks.tableId, share.tableId))
          .limit(1);
        if (!table) {
          return reply.status(404).send({ error: "Table not found" });
        }

        const swimlanes = await fastify.drizzle
          .select()
          .from(tableSwimlanes)
          .where(eq(tableSwimlanes.tableId, share.tableId))
          .orderBy(tableSwimlanes.createdAt);

        const swimlaneIds = swimlanes.map((s) => s.swimlaneId);
        const tasks =
          swimlaneIds.length > 0
            ? await fastify.drizzle
                .select({
                  taskId: personalTasks.taskId,
                  swimlaneId: personalTasks.swimlaneId,
                  content: personalTasks.content,
                  status: personalTasks.status,
                  priority: personalTasks.priority,
                  detail: personalTasks.detail,
                  checklist: personalTasks.checklist,
                  taskDate: personalTasks.taskDate,
                  createdAt: personalTasks.createdAt,
                  updatedAt: personalTasks.updatedAt,
                })
                .from(personalTasks)
                .where(inArray(personalTasks.swimlaneId, swimlaneIds))
            : [];

        let isOwner = false;
        const authHeader = request.headers.authorization;
        if (authHeader?.startsWith("Bearer ")) {
          try {
            const { jwtVerify } = await import("jose");
            const { accessTokenSecret } = await import("../auth/auth");
            const token = authHeader.slice(7);
            const { payload } = await jwtVerify(token, accessTokenSecret);
            const userId = (payload as { userId?: string }).userId;
            isOwner = userId === share.ownerId;
          } catch {
            // Invalid or expired token – treat as guest
          }
        }

        return {
          data: {
            tableId: table.tableId,
            shareId: share.shareId,
            isOwner,
            followUpTableId: table.followUpTableId ?? undefined,
            table: {
              ...table,
              swimlanes: swimlanes.map((swimlane) => ({
                ...swimlane,
                tasks: tasks.filter((t) => t.swimlaneId === swimlane.swimlaneId),
              })),
            },
          },
        };
      } catch (error: any) {
        fastify.log.error({ err: error }, "Error fetching shared table");
        return reply.status(500).send({ error: error.message });
      }
    }
  );

  // Fork shared table: create a copy for the current user (auth required)
  fastify.post(
    "/api/share/table/:shareId/fork",
    { preHandler: [verifyAccessToken] },
    async (request, reply) => {
      try {
        if (!fastify.drizzle) {
          return reply.status(500).send({ error: "Database not available" });
        }
        const authRequest = request as AuthenticatedRequest;
        if (!authRequest.user) return reply.status(401).send({ error: "Unauthorized" });
        const userId = authRequest.user.userId;
        const { shareId } = request.params as { shareId: string };

        const [share] = await fastify.drizzle
          .select()
          .from(shareTable)
          .where(eq(shareTable.shareId, shareId))
          .limit(1);
        if (!share || !share.isPublic) {
          return reply.status(404).send({ error: "Share not found or link is disabled" });
        }
        if (share.ownerId === userId) {
          return reply.status(400).send({
            error: "You own this table. Use Personal Tasks to edit it.",
          });
        }

        const [originalTable] = await fastify.drizzle
          .select()
          .from(tableWeeks)
          .where(eq(tableWeeks.tableId, share.tableId))
          .limit(1);
        if (!originalTable) {
          return reply.status(404).send({ error: "Table not found" });
        }

        const swimlanes = await fastify.drizzle
          .select()
          .from(tableSwimlanes)
          .where(eq(tableSwimlanes.tableId, share.tableId))
          .orderBy(tableSwimlanes.createdAt);

        const result = await fastify.drizzle.transaction(async (tx) => {
          const [newTable] = await tx
            .insert(tableWeeks)
            .values({
              userId,
              week: originalTable.week,
              startDate: originalTable.startDate,
              description: originalTable.description,
              followUpTableId: share.tableId,
            })
            .returning();

          const oldToNewSwimlaneId = new Map<string, string>();
          for (const sl of swimlanes) {
            const [newSl] = await tx
              .insert(tableSwimlanes)
              .values({
                tableId: newTable.tableId,
                content: sl.content,
                startTime: sl.startTime,
                duration: sl.duration,
              })
              .returning();
            oldToNewSwimlaneId.set(sl.swimlaneId, newSl.swimlaneId);
          }

          const tasksToCopy = await tx
            .select()
            .from(personalTasks)
            .where(inArray(personalTasks.swimlaneId, swimlanes.map((s) => s.swimlaneId)));

          for (const task of tasksToCopy) {
            const newSwimlaneId = oldToNewSwimlaneId.get(task.swimlaneId);
            if (!newSwimlaneId) continue;
            await tx.insert(personalTasks).values({
              swimlaneId: newSwimlaneId,
              content: task.content,
              status: task.status,
              priority: task.priority,
              detail: task.detail,
              checklist: task.checklist,
              taskDate: task.taskDate,
            });
          }

          return { table: newTable };
        });

        return { data: { tableId: result.table.tableId } };
      } catch (error: any) {
        fastify.log.error({ err: error }, "Error forking shared table");
        return reply.status(500).send({ error: error.message });
      }
    }
  );
};

export default shareRoutes;
