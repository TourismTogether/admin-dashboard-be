import { FastifyPluginAsync } from "fastify";
import { eq, and, inArray } from "drizzle-orm";
import { groupTasks, userGroupTasks, groups, memberships, users } from "../../db/schema";
import { verifyAccessToken, AuthenticatedRequest } from "../auth/auth";
import {
  getGroupTasksRouteSchema,
  getGroupTaskRouteSchema,
  createGroupTaskRouteSchema,
  updateGroupTaskRouteSchema,
  deleteGroupTaskRouteSchema,
} from "./schemas";

const groupTasksRoutes: FastifyPluginAsync = async (fastify) => {
  // Get all group tasks for the authenticated user
  fastify.get(
    "/api/group-tasks",
    {
      schema: getGroupTasksRouteSchema,
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

        const query = request.query as {
          groupId?: string;
          status?: string;
          priority?: string;
        };

        // Get all groups the user is a member of
        const userGroups = await fastify.drizzle
          .select({ groupId: memberships.groupId })
          .from(memberships)
          .where(eq(memberships.userId, userId));

        const groupIds = userGroups.map((g) => g.groupId);

        if (groupIds.length === 0) {
          return { data: [] };
        }

        // Build query conditions
        const conditions = [inArray(groupTasks.groupId, groupIds)];

        if (query.groupId) {
          conditions.push(eq(groupTasks.groupId, query.groupId));
        }
        if (query.status) {
          conditions.push(eq(groupTasks.status, query.status));
        }
        if (query.priority) {
          conditions.push(eq(groupTasks.priority, query.priority));
        }

        const tasks = await fastify.drizzle
          .select()
          .from(groupTasks)
          .where(and(...conditions))
          .orderBy(groupTasks.createdAt);

        const taskIds = tasks.map((t) => t.groupTaskId);

        let assigneesByTask = new Map<string, Array<{ userId: string; email: string; nickname: string | null; fullname: string | null }>>();

        if (taskIds.length > 0) {
          const assignees = await fastify.drizzle
            .select({
              groupTaskId: userGroupTasks.groupTaskId,
              userId: users.userId,
              email: users.email,
              nickname: users.nickname,
              fullname: users.fullname,
            })
            .from(userGroupTasks)
            .innerJoin(users, eq(userGroupTasks.userId, users.userId))
            .where(inArray(userGroupTasks.groupTaskId, taskIds));

          assigneesByTask = assignees.reduce((map, row) => {
            const list = map.get(row.groupTaskId) || [];
            list.push({
              userId: row.userId,
              email: row.email,
              nickname: row.nickname,
              fullname: row.fullname,
            });
            map.set(row.groupTaskId, list);
            return map;
          }, new Map<string, Array<{ userId: string; email: string; nickname: string | null; fullname: string | null }>>());
        }

        const tasksWithAssignees = tasks.map((task) => ({
          ...task,
          assignees: assigneesByTask.get(task.groupTaskId) || [],
        }));

        return { data: tasksWithAssignees };
      } catch (error: any) {
        fastify.log.error({ err: error }, "Error fetching group tasks");
        return reply.status(500).send({ error: error.message });
      }
    }
  );

  // Get a single group task
  fastify.get(
    "/api/group-tasks/:groupTaskId",
    {
      schema: getGroupTaskRouteSchema,
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

        const { groupTaskId } = request.params as { groupTaskId: string };

        // Get task and verify user has access (is member of the group)
        const [task] = await fastify.drizzle
          .select()
          .from(groupTasks)
          .where(eq(groupTasks.groupTaskId, groupTaskId))
          .limit(1);

        if (!task) {
          return reply.status(404).send({ error: "Group task not found" });
        }

        // Verify user is a member of the group
        const [membership] = await fastify.drizzle
          .select()
          .from(memberships)
          .where(
            and(
              eq(memberships.groupId, task.groupId),
              eq(memberships.userId, userId)
            )
          )
          .limit(1);

        if (!membership) {
          return reply.status(403).send({ error: "Access denied" });
        }

        let assignees: Array<{ userId: string; email: string; nickname: string | null; fullname: string | null }> = [];

        if (task) {
          assignees = await fastify.drizzle
            .select({
              userId: users.userId,
              email: users.email,
              nickname: users.nickname,
              fullname: users.fullname,
            })
            .from(userGroupTasks)
            .innerJoin(users, eq(userGroupTasks.userId, users.userId))
            .where(eq(userGroupTasks.groupTaskId, task.groupTaskId));
        }

        return {
          data: {
            ...task,
            assignees,
          },
        };
      } catch (error: any) {
        fastify.log.error({ err: error }, "Error fetching group task");
        return reply.status(500).send({ error: error.message });
      }
    }
  );

  // Create a new group task
  fastify.post(
    "/api/group-tasks",
    {
      schema: createGroupTaskRouteSchema,
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
          groupId: string;
          priority?: string;
          status?: string;
          startDate?: string;
          endDate?: string;
          requirement?: string;
          delivery?: string;
          note?: string;
        };

        // Verify user is a member of the group
        const [membership] = await fastify.drizzle
          .select()
          .from(memberships)
          .where(
            and(
              eq(memberships.groupId, body.groupId),
              eq(memberships.userId, userId)
            )
          )
          .limit(1);

        if (!membership) {
          return reply.status(403).send({ error: "You are not a member of this group" });
        }

        // Create task
        const [newTask] = await fastify.drizzle
          .insert(groupTasks)
          .values({
            groupId: body.groupId,
            priority: body.priority || "medium",
            status: body.status || "todo",
            startDate: body.startDate,
            endDate: body.endDate,
            requirement: body.requirement,
            delivery: body.delivery,
            note: body.note,
          })
          .returning();

        const requestedAssignees = Array.isArray((body as any).assigneeIds)
          ? (body as any).assigneeIds.filter((id: unknown) => typeof id === "string")
          : [];

        // Only assign explicitly selected users; do not auto-assign creator
        const uniqueAssigneeIds = Array.from(new Set(requestedAssignees)) as string[];

        // Validate assignees are members of the group
        if (uniqueAssigneeIds.length > 0) {
          const validMembers = await fastify.drizzle
            .select({ userId: memberships.userId })
            .from(memberships)
            .where(and(eq(memberships.groupId, body.groupId), inArray(memberships.userId, uniqueAssigneeIds)));

          const validIds = new Set(validMembers.map((m) => m.userId));
          const invalidIds = uniqueAssigneeIds.filter((id) => !validIds.has(id));

          if (invalidIds.length > 0) {
            return reply.status(400).send({ error: "One or more assignees are not members of this group" });
          }

          const assignments = uniqueAssigneeIds.map((id) => ({
            groupTaskId: newTask.groupTaskId,
            userId: id,
          }));

          await fastify.drizzle.insert(userGroupTasks).values(assignments);
        }

        const assignees = await fastify.drizzle
          .select({
            userId: users.userId,
            email: users.email,
            nickname: users.nickname,
            fullname: users.fullname,
          })
          .from(userGroupTasks)
          .innerJoin(users, eq(userGroupTasks.userId, users.userId))
          .where(eq(userGroupTasks.groupTaskId, newTask.groupTaskId));

        return reply.status(201).send({
          data: {
            ...newTask,
            assignees,
          },
        });
      } catch (error: any) {
        fastify.log.error({ err: error }, "Error creating group task");
        return reply.status(500).send({ error: error.message });
      }
    }
  );

  // Update a group task
  fastify.put(
    "/api/group-tasks/:groupTaskId",
    {
      schema: updateGroupTaskRouteSchema,
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

        const { groupTaskId } = request.params as { groupTaskId: string };
        const body = request.body as {
          priority?: string;
          status?: string;
          startDate?: string;
          endDate?: string;
          requirement?: string;
          delivery?: string;
          note?: string;
          assigneeIds?: string[];
        };

        // Get task and verify access
        const [task] = await fastify.drizzle
          .select()
          .from(groupTasks)
          .where(eq(groupTasks.groupTaskId, groupTaskId))
          .limit(1);

        if (!task) {
          return reply.status(404).send({ error: "Group task not found" });
        }

        // Verify user is a member of the group
        const [membership] = await fastify.drizzle
          .select()
          .from(memberships)
          .where(
            and(
              eq(memberships.groupId, task.groupId),
              eq(memberships.userId, userId)
            )
          )
          .limit(1);

        if (!membership) {
          return reply.status(403).send({ error: "Access denied" });
        }

        // Update task core fields
        const { assigneeIds, ...taskUpdateFields } = body;

        const [updatedTask] = await fastify.drizzle
          .update(groupTasks)
          .set({
            ...taskUpdateFields,
            updatedAt: new Date(),
          })
          .where(eq(groupTasks.groupTaskId, groupTaskId))
          .returning();

        // If assigneeIds provided, update assignments
        if (assigneeIds) {
          const requestedAssignees = Array.isArray(assigneeIds)
            ? assigneeIds.filter((id: unknown) => typeof id === "string")
            : [] as string[];

          const uniqueAssigneeIds = Array.from(new Set(requestedAssignees)) as string[];

          // Validate new assignees are members of the group
          if (uniqueAssigneeIds.length > 0) {
            const validMembers = await fastify.drizzle
              .select({ userId: memberships.userId })
              .from(memberships)
              .where(and(eq(memberships.groupId, task.groupId), inArray(memberships.userId, uniqueAssigneeIds)));

            const validIds = new Set(validMembers.map((m) => m.userId));
            const invalidIds = uniqueAssigneeIds.filter((id) => !validIds.has(id));
            if (invalidIds.length > 0) {
              return reply.status(400).send({ error: "One or more assignees are not members of this group" });
            }
          }

          // Replace current assignments with new set
          await fastify.drizzle
            .delete(userGroupTasks)
            .where(eq(userGroupTasks.groupTaskId, groupTaskId));

          if (uniqueAssigneeIds.length > 0) {
            const assignments = uniqueAssigneeIds.map((id) => ({
              groupTaskId: groupTaskId,
              userId: id,
            }));
            await fastify.drizzle.insert(userGroupTasks).values(assignments);
          }
        }

        return { data: updatedTask };
      } catch (error: any) {
        fastify.log.error({ err: error }, "Error updating group task");
        return reply.status(500).send({ error: error.message });
      }
    }
  );

  // Delete a group task
  fastify.delete(
    "/api/group-tasks/:groupTaskId",
    {
      schema: deleteGroupTaskRouteSchema,
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

        const { groupTaskId } = request.params as { groupTaskId: string };

        // Get task and verify access
        const [task] = await fastify.drizzle
          .select()
          .from(groupTasks)
          .where(eq(groupTasks.groupTaskId, groupTaskId))
          .limit(1);

        if (!task) {
          return reply.status(404).send({ error: "Group task not found" });
        }

        // Verify user is a member of the group (and optionally check role for delete permission)
        const [membership] = await fastify.drizzle
          .select()
          .from(memberships)
          .where(
            and(
              eq(memberships.groupId, task.groupId),
              eq(memberships.userId, userId)
            )
          )
          .limit(1);

        if (!membership) {
          return reply.status(403).send({ error: "Access denied" });
        }

        await fastify.drizzle
          .delete(groupTasks)
          .where(eq(groupTasks.groupTaskId, groupTaskId));

        return { message: "Group task deleted successfully" };
      } catch (error: any) {
        fastify.log.error({ err: error }, "Error deleting group task");
        return reply.status(500).send({ error: error.message });
      }
    }
  );
};

export default groupTasksRoutes;
