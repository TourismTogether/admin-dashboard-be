import { FastifyPluginAsync } from "fastify";
import { eq, and, inArray } from "drizzle-orm";
import {
  tableWeeks,
  tableSwimlanes,
  personalTasks,
  users,
} from "../db/schema";

const personalTasksRoutes: FastifyPluginAsync = async (fastify) => {
  // Get all tables for a user
  fastify.get("/api/personal-tasks/tables", async (request, reply) => {
    try {
      if (!fastify.drizzle) {
        return reply.status(500).send({ error: "Database not available" });
      }

      // Get or create default user
      const userId = await getOrCreateDefaultUser();
      if (!userId) {
        return reply.status(500).send({ error: "Failed to get user" });
      }

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
  });

  // Get a single table with swimlanes and tasks
  fastify.get("/api/personal-tasks/tables/:tableId", async (request, reply) => {
    try {
      if (!fastify.drizzle) {
        return reply.status(500).send({ error: "Database not available" });
      }

      const { tableId } = request.params as { tableId: string };

      // Get table
      const [table] = await fastify.drizzle
        .select()
        .from(tableWeeks)
        .where(eq(tableWeeks.tableId, tableId))
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
      const tasks = swimlaneIds.length > 0
        ? await fastify.drizzle
            .select()
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
  });

  // Helper function to get or create default user
  const getOrCreateDefaultUser = async () => {
    if (!fastify.drizzle) return null;

    // Try to get existing default user
    const [existingUser] = await fastify.drizzle
      .select()
      .from(users)
      .where(eq(users.account, "default"))
      .limit(1);

    if (existingUser) {
      return existingUser.userId;
    }

    // Create default user if not exists
    const [newUser] = await fastify.drizzle
      .insert(users)
      .values({
        account: "default",
        password: "default", // In production, this should be hashed
        email: "default@example.com",
        nickname: "Default User",
      })
      .returning();

    return newUser.userId;
  };

  // Create a new table
  fastify.post("/api/personal-tasks/tables", async (request, reply) => {
    try {
      if (!fastify.drizzle) {
        return reply.status(500).send({ error: "Database not available" });
      }

      const body = request.body as {
        startDate: string;
        week: number;
        description?: string;
      };

      // Get or create default user
      const userId = await getOrCreateDefaultUser();
      if (!userId) {
        return reply.status(500).send({ error: "Failed to get user" });
      }

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

        // Create 3 default swimlanes
        const defaultSwimlanes = [
          { content: "Sáng", startTime: "07:00:00", duration: 240 }, // 7h-11h (4 hours = 240 minutes)
          { content: "Chiều", startTime: "14:00:00", duration: 180 }, // 2h-5h (3 hours = 180 minutes)
          { content: "Tối", startTime: "18:00:00", duration: 360 }, // 6h-12h (6 hours = 360 minutes)
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
  });

  // Update a table
  fastify.put("/api/personal-tasks/tables/:tableId", async (request, reply) => {
    try {
      if (!fastify.drizzle) {
        return reply.status(500).send({ error: "Database not available" });
      }

      const { tableId } = request.params as { tableId: string };
      const body = request.body as {
        startDate?: string;
        week?: number;
        description?: string;
      };

      const [updatedTable] = await fastify.drizzle
        .update(tableWeeks)
        .set({
          ...body,
          updatedAt: new Date(),
        })
        .where(eq(tableWeeks.tableId, tableId))
        .returning();

      if (!updatedTable) {
        return reply.status(404).send({ error: "Table not found" });
      }

      return { data: updatedTable };
    } catch (error: any) {
      fastify.log.error({ err: error }, "Error updating table");
      return reply.status(500).send({ error: error.message });
    }
  });

  // Delete a table
  fastify.delete(
    "/api/personal-tasks/tables/:tableId",
    async (request, reply) => {
      try {
        if (!fastify.drizzle) {
          return reply.status(500).send({ error: "Database not available" });
        }

        const { tableId } = request.params as { tableId: string };

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
  fastify.post("/api/personal-tasks/swimlanes", async (request, reply) => {
    try {
      if (!fastify.drizzle) {
        return reply.status(500).send({ error: "Database not available" });
      }

      const body = request.body as {
        tableId: string;
        content: string;
        startTime?: string;
        duration?: number;
      };

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
  });

  // Update a swimlane
  fastify.put(
    "/api/personal-tasks/swimlanes/:swimlaneId",
    async (request, reply) => {
      try {
        if (!fastify.drizzle) {
          return reply.status(500).send({ error: "Database not available" });
        }

        const { swimlaneId } = request.params as { swimlaneId: string };
        const body = request.body as {
          content?: string;
          startTime?: string;
          duration?: number;
        };

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
    async (request, reply) => {
      try {
        if (!fastify.drizzle) {
          return reply.status(500).send({ error: "Database not available" });
        }

        const { swimlaneId } = request.params as { swimlaneId: string };

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
  fastify.post("/api/personal-tasks/tasks", async (request, reply) => {
    try {
      if (!fastify.drizzle) {
        return reply.status(500).send({ error: "Database not available" });
      }

      const body = request.body as {
        swimlaneId: string;
        content: string;
        status?: string;
        priority?: string;
        detail?: string;
        taskDate: string; // YYYY-MM-DD format
      };

      const [newTask] = await fastify.drizzle
        .insert(personalTasks)
        .values({
          swimlaneId: body.swimlaneId,
          content: body.content,
          status: body.status || "todo",
          priority: body.priority || "medium",
          detail: body.detail,
          taskDate: body.taskDate,
        })
        .returning();

      return { data: newTask };
    } catch (error: any) {
      fastify.log.error({ err: error }, "Error creating task");
      return reply.status(500).send({ error: error.message });
    }
  });

  // Update a task
  fastify.put("/api/personal-tasks/tasks/:taskId", async (request, reply) => {
    try {
      if (!fastify.drizzle) {
        return reply.status(500).send({ error: "Database not available" });
      }

      const { taskId } = request.params as { taskId: string };
      const body = request.body as {
        content?: string;
        status?: string;
        priority?: string;
        detail?: string;
      };

      const [updatedTask] = await fastify.drizzle
        .update(personalTasks)
        .set({
          ...body,
          updatedAt: new Date(),
        })
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
  });

  // Delete a task
  fastify.delete(
    "/api/personal-tasks/tasks/:taskId",
    async (request, reply) => {
      try {
        if (!fastify.drizzle) {
          return reply.status(500).send({ error: "Database not available" });
        }

        const { taskId } = request.params as { taskId: string };

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
};

export default personalTasksRoutes;
