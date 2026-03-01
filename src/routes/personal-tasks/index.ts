import { FastifyPluginAsync } from "fastify";
import { eq, and, inArray, desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import { tableWeeks, tableSwimlanes, personalTasks, shareTable } from "../../db/schema";
import { verifyAccessToken, AuthenticatedRequest } from "../auth/auth";
import {
  getTablesRouteSchema,
  getTableRouteSchema,
  createTableRouteSchema,
  updateTableRouteSchema,
  deleteTableRouteSchema,
  createSwimlaneRouteSchema,
  updateSwimlaneRouteSchema,
  deleteSwimlaneRouteSchema,
  createTaskRouteSchema,
  updateTaskRouteSchema,
  deleteTaskRouteSchema,
  getRecentTasksRouteSchema,
} from "./schemas";
// Email feature temporarily disabled (incomplete / has bugs)
// import { sendWeeklyEmailForUser } from "../../jobs/weeklyPersonalTasksEmail";

const personalTasksRoutes: FastifyPluginAsync = async (fastify) => {
  // Get all tables for a user
  fastify.get(
    "/api/personal-tasks/tables",
    {
      schema: getTablesRouteSchema,
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

        const tables = await fastify.drizzle
          .select()
          .from(tableWeeks)
          .where(eq(tableWeeks.userId, userId))
          .orderBy(tableWeeks.createdAt);

        return { data: tables };
      } catch (error: any) {
        fastify.log.error({ err: error }, "Error fetching tables");
        return reply.status(500).send({ error: error.message });
      }
    }
  );

  // Get a single table with swimlanes and tasks
  fastify.get(
    "/api/personal-tasks/tables/:tableId",
    {
      schema: getTableRouteSchema,
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

        const { tableId } = request.params as { tableId: string };

        // Get table and verify ownership
        const [table] = await fastify.drizzle
          .select()
          .from(tableWeeks)
          .where(
            and(eq(tableWeeks.tableId, tableId), eq(tableWeeks.userId, userId))
          )
          .limit(1);

        if (!table) {
          return reply.status(404).send({ error: "Table not found" });
        }

        // Get swimlanes for this table
        const swimlanes = await fastify.drizzle
          .select()
          .from(tableSwimlanes)
          .where(eq(tableSwimlanes.tableId, tableId))
          .orderBy(tableSwimlanes.createdAt);

        // Get tasks for all swimlanes
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

        return {
          data: {
            ...table,
            swimlanes: swimlanes.map((swimlane) => ({
              ...swimlane,
              tasks: tasks.filter(
                (task) => task.swimlaneId === swimlane.swimlaneId
              ),
            })),
          },
        };
      } catch (error: any) {
        fastify.log.error({ err: error }, "Error fetching table");
        return reply.status(500).send({ error: error.message });
      }
    }
  );

  // Create a new table
  fastify.post(
    "/api/personal-tasks/tables",
    {
      schema: createTableRouteSchema,
      preHandler: [verifyAccessToken],
    },
    async (request, reply) => {
      try {
        if (!fastify.drizzle) {
          return reply.status(500).send({ error: "Database not available" });
        }

        const body = request.body as {
          startDate: string;
          week: number;
          description?: string;
        };

        const authRequest = request as AuthenticatedRequest;
        if (!authRequest.user) {
          return reply.status(401).send({ error: "Unauthorized" });
        }
        const userId = authRequest.user.userId;

        // Create table and default swimlanes in a transaction
        const result = await fastify.drizzle.transaction(async (tx) => {
          // Create table
          const [newTable] = await tx
            .insert(tableWeeks)
            .values({
              userId,
              startDate: body.startDate,
              week: body.week,
              description: body.description,
            })
            .returning();

          // Create 3 default swimlanes: Morning, Afternoon, Evening
          const defaultSwimlanes = [
            { content: "Morning", startTime: "07:00:00", duration: 240 }, // 07:00-11:00 (4h)
            { content: "Afternoon", startTime: "14:00:00", duration: 180 }, // 14:00-17:00 (3h)
            { content: "Evening", startTime: "18:00:00", duration: 360 }, // 18:00-00:00 (6h)
          ];

          const createdSwimlanes = await Promise.all(
            defaultSwimlanes.map((swimlane) =>
              tx
                .insert(tableSwimlanes)
                .values({
                  tableId: newTable.tableId,
                  content: swimlane.content,
                  startTime: swimlane.startTime,
                  duration: swimlane.duration,
                })
                .returning()
            )
          );

          return { table: newTable, swimlanes: createdSwimlanes };
        });

        return { data: result.table, swimlanes: result.swimlanes };
      } catch (error: any) {
        fastify.log.error({ err: error }, "Error creating table");
        return reply.status(500).send({ error: error.message });
      }
    }
  );

  // Update a table
  fastify.put(
    "/api/personal-tasks/tables/:tableId",
    {
      schema: updateTableRouteSchema,
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

        const { tableId } = request.params as { tableId: string };
        const body = request.body as {
          startDate?: string;
          week?: number;
          description?: string;
        };

        // Verify ownership before updating
        const [existingTable] = await fastify.drizzle
          .select()
          .from(tableWeeks)
          .where(
            and(eq(tableWeeks.tableId, tableId), eq(tableWeeks.userId, userId))
          )
          .limit(1);

        if (!existingTable) {
          return reply.status(404).send({ error: "Table not found" });
        }

        const [updatedTable] = await fastify.drizzle
          .update(tableWeeks)
          .set({
            ...body,
            updatedAt: new Date(),
          })
          .where(eq(tableWeeks.tableId, tableId))
          .returning();

        return { data: updatedTable };
      } catch (error: any) {
        fastify.log.error({ err: error }, "Error updating table");
        return reply.status(500).send({ error: error.message });
      }
    }
  );

  // Delete a table
  fastify.delete(
    "/api/personal-tasks/tables/:tableId",
    {
      schema: deleteTableRouteSchema,
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

        const { tableId } = request.params as { tableId: string };

        // Verify ownership before deleting
        const [existingTable] = await fastify.drizzle
          .select()
          .from(tableWeeks)
          .where(
            and(eq(tableWeeks.tableId, tableId), eq(tableWeeks.userId, userId))
          )
          .limit(1);

        if (!existingTable) {
          return reply.status(404).send({ error: "Table not found" });
        }

        await fastify.drizzle
          .delete(tableWeeks)
          .where(eq(tableWeeks.tableId, tableId));

        return { message: "Table deleted successfully" };
      } catch (error: any) {
        fastify.log.error({ err: error }, "Error deleting table");
        return reply.status(500).send({ error: error.message });
      }
    }
  );

  // Create a swimlane
  fastify.post(
    "/api/personal-tasks/swimlanes",
    {
      schema: createSwimlaneRouteSchema,
      preHandler: [verifyAccessToken],
    },
    async (request, reply) => {
      try {
        if (!fastify.drizzle) {
          return reply.status(500).send({ error: "Database not available" });
        }

        const authRequest = request as AuthenticatedRequest;
        if (!authRequest.user) return reply.status(401).send({ error: "Unauthorized" });
        const userId = authRequest.user.userId;

        const body = request.body as {
          tableId: string;
          content: string;
          startTime?: string;
          duration?: number;
        };

        const [table] = await fastify.drizzle
          .select()
          .from(tableWeeks)
          .where(and(eq(tableWeeks.tableId, body.tableId), eq(tableWeeks.userId, userId)))
          .limit(1);
        if (!table) {
          return reply.status(403).send({ error: "You can only add swimlanes to your own tables" });
        }

        const [newSwimlane] = await fastify.drizzle
          .insert(tableSwimlanes)
          .values({
            tableId: body.tableId,
            content: body.content,
            startTime: body.startTime,
            duration: body.duration,
          })
          .returning();

        return { data: newSwimlane };
      } catch (error: any) {
        fastify.log.error({ err: error }, "Error creating swimlane");
        return reply.status(500).send({ error: error.message });
      }
    }
  );

  // Update a swimlane
  fastify.put(
    "/api/personal-tasks/swimlanes/:swimlaneId",
    {
      schema: updateSwimlaneRouteSchema,
      preHandler: [verifyAccessToken],
    },
    async (request, reply) => {
      try {
        if (!fastify.drizzle) {
          return reply.status(500).send({ error: "Database not available" });
        }

        const authRequest = request as AuthenticatedRequest;
        if (!authRequest.user) return reply.status(401).send({ error: "Unauthorized" });
        const userId = authRequest.user.userId;

        const { swimlaneId } = request.params as { swimlaneId: string };
        const body = request.body as {
          content?: string;
          startTime?: string;
          duration?: number;
        };

        const [swimlane] = await fastify.drizzle
          .select({ tableId: tableSwimlanes.tableId })
          .from(tableSwimlanes)
          .where(eq(tableSwimlanes.swimlaneId, swimlaneId))
          .limit(1);
        if (!swimlane) {
          return reply.status(404).send({ error: "Swimlane not found" });
        }

        const [table] = await fastify.drizzle
          .select()
          .from(tableWeeks)
          .where(and(eq(tableWeeks.tableId, swimlane.tableId), eq(tableWeeks.userId, userId)))
          .limit(1);
        if (!table) {
          return reply.status(403).send({ error: "You can only edit your own tables" });
        }

        const [updatedSwimlane] = await fastify.drizzle
          .update(tableSwimlanes)
          .set({
            ...body,
            updatedAt: new Date(),
          })
          .where(eq(tableSwimlanes.swimlaneId, swimlaneId))
          .returning();

        if (!updatedSwimlane) {
          return reply.status(404).send({ error: "Swimlane not found" });
        }

        return { data: updatedSwimlane };
      } catch (error: any) {
        fastify.log.error({ err: error }, "Error updating swimlane");
        return reply.status(500).send({ error: error.message });
      }
    }
  );

  // Delete a swimlane
  fastify.delete(
    "/api/personal-tasks/swimlanes/:swimlaneId",
    {
      schema: deleteSwimlaneRouteSchema,
      preHandler: [verifyAccessToken],
    },
    async (request, reply) => {
      try {
        if (!fastify.drizzle) {
          return reply.status(500).send({ error: "Database not available" });
        }

        const authRequest = request as AuthenticatedRequest;
        if (!authRequest.user) return reply.status(401).send({ error: "Unauthorized" });
        const userId = authRequest.user.userId;

        const { swimlaneId } = request.params as { swimlaneId: string };

        const [swimlane] = await fastify.drizzle
          .select({ tableId: tableSwimlanes.tableId })
          .from(tableSwimlanes)
          .where(eq(tableSwimlanes.swimlaneId, swimlaneId))
          .limit(1);
        if (!swimlane) {
          return reply.status(404).send({ error: "Swimlane not found" });
        }

        const [table] = await fastify.drizzle
          .select()
          .from(tableWeeks)
          .where(and(eq(tableWeeks.tableId, swimlane.tableId), eq(tableWeeks.userId, userId)))
          .limit(1);
        if (!table) {
          return reply.status(403).send({ error: "You can only delete swimlanes in your own tables" });
        }

        await fastify.drizzle
          .delete(tableSwimlanes)
          .where(eq(tableSwimlanes.swimlaneId, swimlaneId));

        return { message: "Swimlane deleted successfully" };
      } catch (error: any) {
        fastify.log.error({ err: error }, "Error deleting swimlane");
        return reply.status(500).send({ error: error.message });
      }
    }
  );

  // Create a task
  fastify.post(
    "/api/personal-tasks/tasks",
    {
      schema: createTaskRouteSchema,
      preHandler: [verifyAccessToken],
    },
    async (request, reply) => {
      try {
        if (!fastify.drizzle) {
          return reply.status(500).send({ error: "Database not available" });
        }

        const authRequest = request as AuthenticatedRequest;
        if (!authRequest.user) return reply.status(401).send({ error: "Unauthorized" });
        const userId = authRequest.user.userId;

        const body = request.body as {
          swimlaneId: string;
          content: string;
          status?: string;
          priority?: string;
          detail?: string;
          checklist?: Array<{
            id: string;
            description: string;
            isComplete: boolean;
          }>;
          taskDate: string; // YYYY-MM-DD format
        };

        const [swimlane] = await fastify.drizzle
          .select({ tableId: tableSwimlanes.tableId })
          .from(tableSwimlanes)
          .where(eq(tableSwimlanes.swimlaneId, body.swimlaneId))
          .limit(1);
        if (!swimlane) {
          return reply.status(404).send({ error: "Swimlane not found" });
        }

        const [table] = await fastify.drizzle
          .select()
          .from(tableWeeks)
          .where(and(eq(tableWeeks.tableId, swimlane.tableId), eq(tableWeeks.userId, userId)))
          .limit(1);
        if (!table) {
          return reply.status(403).send({ error: "You can only create tasks in your own tables" });
        }

        // Handle checklist: if null, set to null; if array with items, set array; if empty array, set to null
        let checklistValue = null;
        if (body.checklist === null) {
          checklistValue = null;
        } else if (Array.isArray(body.checklist) && body.checklist.length > 0) {
          checklistValue = body.checklist;
        } else {
          checklistValue = null;
        }

        const [newTask] = await fastify.drizzle
          .insert(personalTasks)
          .values({
            swimlaneId: body.swimlaneId,
            content: body.content,
            status: body.status || "todo",
            priority: body.priority || "medium",
            detail: body.detail || null,
            checklist: checklistValue,
            taskDate: body.taskDate,
          })
          .returning();

        return { data: newTask };
      } catch (error: any) {
        fastify.log.error({ err: error }, "Error creating task");
        return reply.status(500).send({ error: error.message });
      }
    }
  );

  // Update a task
  fastify.put(
    "/api/personal-tasks/tasks/:taskId",
    {
      schema: updateTaskRouteSchema,
      preHandler: [verifyAccessToken],
    },
    async (request, reply) => {
      try {
        if (!fastify.drizzle) {
          return reply.status(500).send({ error: "Database not available" });
        }

        const authRequest = request as AuthenticatedRequest;
        if (!authRequest.user) return reply.status(401).send({ error: "Unauthorized" });
        const userId = authRequest.user.userId;

        const { taskId } = request.params as { taskId: string };
        const body = request.body as {
          content?: string;
          status?: string;
          priority?: string;
          detail?: string;
          checklist?: Array<{
            id: string;
            description: string;
            isComplete: boolean;
          }>;
          taskDate?: string;
          swimlaneId?: string;
        };

        const [existingTask] = await fastify.drizzle
          .select({ swimlaneId: personalTasks.swimlaneId })
          .from(personalTasks)
          .where(eq(personalTasks.taskId, taskId))
          .limit(1);
        if (!existingTask) {
          return reply.status(404).send({ error: "Task not found" });
        }

        const [swimlane] = await fastify.drizzle
          .select({ tableId: tableSwimlanes.tableId })
          .from(tableSwimlanes)
          .where(eq(tableSwimlanes.swimlaneId, existingTask.swimlaneId))
          .limit(1);
        if (!swimlane) {
          return reply.status(404).send({ error: "Swimlane not found" });
        }

        const [table] = await fastify.drizzle
          .select()
          .from(tableWeeks)
          .where(and(eq(tableWeeks.tableId, swimlane.tableId), eq(tableWeeks.userId, userId)))
          .limit(1);
        if (!table) {
          return reply.status(403).send({ error: "You can only update tasks in your own tables" });
        }

        if (body.swimlaneId !== undefined && body.swimlaneId !== existingTask.swimlaneId) {
          const [newSwimlane] = await fastify.drizzle
            .select({ tableId: tableSwimlanes.tableId })
            .from(tableSwimlanes)
            .where(eq(tableSwimlanes.swimlaneId, body.swimlaneId))
            .limit(1);
          if (!newSwimlane) {
            return reply.status(404).send({ error: "Target swimlane not found" });
          }
          const [newTable] = await fastify.drizzle
            .select()
            .from(tableWeeks)
            .where(and(eq(tableWeeks.tableId, newSwimlane.tableId), eq(tableWeeks.userId, userId)))
            .limit(1);
          if (!newTable) {
            return reply.status(403).send({ error: "You can only move tasks within your own tables" });
          }
        }

        const updateData: any = {
          updatedAt: new Date(),
        };

        // Only include fields that are provided
        if (body.content !== undefined) updateData.content = body.content;
        if (body.status !== undefined) updateData.status = body.status;
        if (body.priority !== undefined) updateData.priority = body.priority;
        if (body.detail !== undefined) updateData.detail = body.detail || null;
        if (body.taskDate !== undefined) updateData.taskDate = body.taskDate;
        if (body.swimlaneId !== undefined)
          updateData.swimlaneId = body.swimlaneId;

        // Handle checklist: if null, set to null; if array with items, set array; if empty array, set to null
        if (body.checklist !== undefined) {
          if (body.checklist === null) {
            updateData.checklist = null;
          } else if (
            Array.isArray(body.checklist) &&
            body.checklist.length > 0
          ) {
            updateData.checklist = body.checklist;
          } else {
            updateData.checklist = null;
          }
        }

        const [updatedTask] = await fastify.drizzle
          .update(personalTasks)
          .set(updateData)
          .where(eq(personalTasks.taskId, taskId))
          .returning();

        if (!updatedTask) {
          return reply.status(404).send({ error: "Task not found" });
        }

        return { data: updatedTask };
      } catch (error: any) {
        fastify.log.error({ err: error }, "Error updating task");
        return reply.status(500).send({ error: error.message });
      }
    }
  );

  // Delete a task
  fastify.delete(
    "/api/personal-tasks/tasks/:taskId",
    {
      schema: deleteTaskRouteSchema,
      preHandler: [verifyAccessToken],
    },
    async (request, reply) => {
      try {
        if (!fastify.drizzle) {
          return reply.status(500).send({ error: "Database not available" });
        }

        const authRequest = request as AuthenticatedRequest;
        if (!authRequest.user) return reply.status(401).send({ error: "Unauthorized" });
        const userId = authRequest.user.userId;

        const { taskId } = request.params as { taskId: string };

        const [existingTask] = await fastify.drizzle
          .select({ swimlaneId: personalTasks.swimlaneId })
          .from(personalTasks)
          .where(eq(personalTasks.taskId, taskId))
          .limit(1);
        if (!existingTask) {
          return reply.status(404).send({ error: "Task not found" });
        }

        const [swimlane] = await fastify.drizzle
          .select({ tableId: tableSwimlanes.tableId })
          .from(tableSwimlanes)
          .where(eq(tableSwimlanes.swimlaneId, existingTask.swimlaneId))
          .limit(1);
        if (!swimlane) {
          return reply.status(404).send({ error: "Swimlane not found" });
        }

        const [table] = await fastify.drizzle
          .select()
          .from(tableWeeks)
          .where(and(eq(tableWeeks.tableId, swimlane.tableId), eq(tableWeeks.userId, userId)))
          .limit(1);
        if (!table) {
          return reply.status(403).send({ error: "You can only delete tasks in your own tables" });
        }

        await fastify.drizzle
          .delete(personalTasks)
          .where(eq(personalTasks.taskId, taskId));

        return { message: "Task deleted successfully" };
      } catch (error: any) {
        fastify.log.error({ err: error }, "Error deleting task");
        return reply.status(500).send({ error: error.message });
      }
    }
  );

  // Get recent tasks (last 10)
  fastify.get(
    "/api/personal-tasks/tasks/recent",
    {
      schema: getRecentTasksRouteSchema,
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

        // Get all swimlane IDs for this user
        const userSwimlanes = await fastify.drizzle
          .select({ swimlaneId: tableSwimlanes.swimlaneId })
          .from(tableSwimlanes)
          .innerJoin(tableWeeks, eq(tableSwimlanes.tableId, tableWeeks.tableId))
          .where(eq(tableWeeks.userId, userId));

        const swimlaneIds = userSwimlanes.map((s) => s.swimlaneId);

        if (swimlaneIds.length === 0) {
          return { data: [] };
        }

        // Get 10 most recent tasks ordered by updatedAt
        const recentTasks = await fastify.drizzle
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
          .orderBy(desc(personalTasks.updatedAt))
          .limit(10);

        return { data: recentTasks };
      } catch (error: any) {
        fastify.log.error({ err: error }, "Error fetching recent tasks");
        return reply.status(500).send({ error: error.message });
      }
    }
  );

  // --- Share table (owner only) ---
  // Get share status for a table
  fastify.get(
    "/api/personal-tasks/tables/:tableId/share",
    { preHandler: [verifyAccessToken] },
    async (request, reply) => {
      try {
        if (!fastify.drizzle) {
          return reply.status(500).send({ error: "Database not available" });
        }
        const authRequest = request as AuthenticatedRequest;
        if (!authRequest.user) return reply.status(401).send({ error: "Unauthorized" });
        const userId = authRequest.user.userId;
        const { tableId } = request.params as { tableId: string };

        const [table] = await fastify.drizzle
          .select()
          .from(tableWeeks)
          .where(and(eq(tableWeeks.tableId, tableId), eq(tableWeeks.userId, userId)))
          .limit(1);
        if (!table) return reply.status(404).send({ error: "Table not found" });

        const [share] = await fastify.drizzle
          .select()
          .from(shareTable)
          .where(eq(shareTable.tableId, tableId))
          .limit(1);
        if (!share) return reply.status(404).send({ error: "Share not found" });

        const baseUrl = process.env.FRONTEND_URL || "http://localhost:5173";
        return {
          data: {
            shareId: share.shareId,
            isPublic: share.isPublic,
            shareUrl: `${baseUrl}/share/table/${share.shareId}`,
          },
        };
      } catch (error: any) {
        fastify.log.error({ err: error }, "Error fetching share");
        return reply.status(500).send({ error: error.message });
      }
    }
  );

  // Create or enable share (owner only)
  fastify.post(
    "/api/personal-tasks/tables/:tableId/share",
    { preHandler: [verifyAccessToken] },
    async (request, reply) => {
      try {
        if (!fastify.drizzle) {
          return reply.status(500).send({ error: "Database not available" });
        }
        const authRequest = request as AuthenticatedRequest;
        if (!authRequest.user) return reply.status(401).send({ error: "Unauthorized" });
        const userId = authRequest.user.userId;
        const { tableId } = request.params as { tableId: string };

        const [table] = await fastify.drizzle
          .select()
          .from(tableWeeks)
          .where(and(eq(tableWeeks.tableId, tableId), eq(tableWeeks.userId, userId)))
          .limit(1);
        if (!table) return reply.status(404).send({ error: "Table not found" });

        const [existing] = await fastify.drizzle
          .select()
          .from(shareTable)
          .where(eq(shareTable.tableId, tableId))
          .limit(1);
        if (existing) {
          await fastify.drizzle
            .update(shareTable)
            .set({ isPublic: true, updatedAt: new Date() })
            .where(eq(shareTable.tableId, tableId));
          const baseUrl = process.env.FRONTEND_URL || "http://localhost:5173";
          return {
            data: {
              shareId: existing.shareId,
              isPublic: true,
              shareUrl: `${baseUrl}/share/table/${existing.shareId}`,
            },
          };
        }

        const shareId = randomUUID();
        await fastify.drizzle.insert(shareTable).values({
          tableId,
          ownerId: userId,
          shareId,
          isPublic: true,
        });
        const baseUrl = process.env.FRONTEND_URL || "http://localhost:5173";
        return {
          data: {
            shareId,
            isPublic: true,
            shareUrl: `${baseUrl}/share/table/${shareId}`,
          },
        };
      } catch (error: any) {
        fastify.log.error({ err: error }, "Error creating share");
        return reply.status(500).send({ error: error.message });
      }
    }
  );

  // Make private (delete share record) (owner only)
  fastify.delete(
    "/api/personal-tasks/tables/:tableId/share",
    { preHandler: [verifyAccessToken] },
    async (request, reply) => {
      try {
        if (!fastify.drizzle) {
          return reply.status(500).send({ error: "Database not available" });
        }
        const authRequest = request as AuthenticatedRequest;
        if (!authRequest.user) return reply.status(401).send({ error: "Unauthorized" });
        const userId = authRequest.user.userId;
        const { tableId } = request.params as { tableId: string };

        const [table] = await fastify.drizzle
          .select()
          .from(tableWeeks)
          .where(and(eq(tableWeeks.tableId, tableId), eq(tableWeeks.userId, userId)))
          .limit(1);
        if (!table) return reply.status(404).send({ error: "Table not found" });

        await fastify.drizzle.delete(shareTable).where(eq(shareTable.tableId, tableId));
        return { message: "Share disabled" };
      } catch (error: any) {
        fastify.log.error({ err: error }, "Error deleting share");
        return reply.status(500).send({ error: error.message });
      }
    }
  );

  // Send weekly email report – TEMPORARILY DISABLED (feature incomplete / has bugs)
  // fastify.post(
  //   "/api/personal-tasks/send-weekly-email",
  //   { preHandler: [verifyAccessToken] },
  //   async (request, reply) => {
  //     const result = await sendWeeklyEmailForUser(fastify, userId);
  //     ...
  //   }
  // );
  fastify.post(
    "/api/personal-tasks/send-weekly-email",
    { preHandler: [verifyAccessToken] },
    async (_request, reply) => {
      return reply.status(503).send({
        error: "Email feature is temporarily disabled (incomplete).",
      });
    }
  );
};

export default personalTasksRoutes;
