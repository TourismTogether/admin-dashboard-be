import { FastifyPluginAsync } from "fastify";
import { and, eq } from "drizzle-orm";
import { groups, memberships, users } from "../../db/schema";
import { verifyAccessToken, AuthenticatedRequest } from "../auth/auth";
import {
  getGroupsRouteSchema,
  createGroupRouteSchema,
  addGroupMemberRouteSchema,
  deleteGroupRouteSchema,
  getGroupMembersRouteSchema,
  updateGroupRouteSchema,
  removeGroupMemberRouteSchema,
  leaveGroupRouteSchema,
} from "./schemas";

const groupsRoutes: FastifyPluginAsync = async (fastify) => {
  // Get all groups for the authenticated user
  fastify.get(
    "/api/groups",
    {
      schema: getGroupsRouteSchema,
      preHandler: [verifyAccessToken],
    },
    async (request, reply) => {
      try {
        if (!fastify.drizzle) {
          return reply.code(500).send({ error: "Database not available" });
        }

        const authRequest = request as AuthenticatedRequest;
        if (!authRequest.user) {
          return reply.code(401).send({ error: "Unauthorized" });
        }
        const userId = authRequest.user.userId;

        // Get all groups the user is a member of with their role
        const userGroupsData = await fastify.drizzle
          .select({
            groupId: groups.groupId,
            name: groups.name,
            description: groups.description,
            imageUrl: groups.imageUrl,
            role: memberships.role,
          })
          .from(memberships)
          .innerJoin(groups, eq(memberships.groupId, groups.groupId))
          .where(eq(memberships.userId, userId));

        return { data: userGroupsData };
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: "Failed to fetch groups" });
      }
    }
  );

  // Get members of a group
  fastify.get(
    "/api/groups/:groupId/members",
    {
      schema: getGroupMembersRouteSchema,
      preHandler: [verifyAccessToken],
    },
    async (request, reply) => {
      try {
        if (!fastify.drizzle) {
          return reply.code(500).send({ error: "Database not available" });
        }

        const authRequest = request as AuthenticatedRequest;
        if (!authRequest.user) {
          return reply.code(401).send({ error: "Unauthorized" });
        }

        const requesterId = authRequest.user.userId;
        const { groupId } = request.params as { groupId: string };

        const [requesterMembership] = await fastify.drizzle
          .select()
          .from(memberships)
          .where(and(eq(memberships.groupId, groupId), eq(memberships.userId, requesterId)))
          .limit(1);

        if (!requesterMembership) {
          return reply.code(403).send({ error: "You are not a member of this group" });
        }

        const members = await fastify.drizzle
          .select({
            userId: memberships.userId,
            email: users.email,
            nickname: users.nickname,
            fullname: users.fullname,
            role: memberships.role,
          })
          .from(memberships)
          .innerJoin(users, eq(memberships.userId, users.userId))
          .where(eq(memberships.groupId, groupId));

        return { data: members };
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: "Failed to fetch group members" });
      }
    }
  );

  // Create a new group
  fastify.post(
    "/api/groups",
    {
      schema: createGroupRouteSchema,
      preHandler: [verifyAccessToken],
    },
    async (request, reply) => {
      try {
        if (!fastify.drizzle) {
          return reply.code(500).send({ error: "Database not available" });
        }

        const authRequest = request as AuthenticatedRequest;
        if (!authRequest.user) {
          return reply.code(401).send({ error: "Unauthorized" });
        }
        const userId = authRequest.user.userId;

        const body = request.body as {
          name: string;
          description?: string;
          imageUrl?: string;
        };

        // Validate required fields
        if (!body.name || body.name.trim().length === 0) {
          return reply.code(400).send({ error: "Group name is required" });
        }

        // Create the group
        const newGroup = await fastify.drizzle
          .insert(groups)
          .values({
            name: body.name.trim(),
            description: body.description?.trim() || null,
            imageUrl: body.imageUrl || null,
          })
          .returning();

        if (!newGroup || newGroup.length === 0) {
          return reply.code(500).send({ error: "Failed to create group" });
        }

        const groupId = newGroup[0].groupId;

        // Add the creator as the owner (default role is "owner")
        await fastify.drizzle.insert(memberships).values({
          userId,
          groupId,
          role: "owner",
        });

        return reply.code(201).send({
          data: {
            ...newGroup[0],
            role: "owner",
          },
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: "Failed to create group" });
      }
    }
  );

  // Add a member to a group
  fastify.post(
    "/api/groups/:groupId/members",
    {
      schema: addGroupMemberRouteSchema,
      preHandler: [verifyAccessToken],
    },
    async (request, reply) => {
      try {
        if (!fastify.drizzle) {
          return reply.code(500).send({ error: "Database not available" });
        }

        const authRequest = request as AuthenticatedRequest;
        if (!authRequest.user) {
          return reply.code(401).send({ error: "Unauthorized" });
        }

        const requesterId = authRequest.user.userId;
        const { groupId } = request.params as { groupId: string };
        const { email, role } = request.body as { email: string; role?: string };

        if (!email?.trim()) {
          return reply.code(400).send({ error: "Email is required" });
        }

        // Verify requester is a member with permission
        const [requesterMembership] = await fastify.drizzle
          .select()
          .from(memberships)
          .where(and(eq(memberships.groupId, groupId), eq(memberships.userId, requesterId)))
          .limit(1);

        if (!requesterMembership) {
          return reply.code(403).send({ error: "You are not a member of this group" });
        }

        const allowedRoles = new Set(["owner", "admin", "leader"]);
        if (!allowedRoles.has(requesterMembership.role)) {
          return reply.code(403).send({ error: "Insufficient permissions to add members" });
        }

        // Find target user
        const [targetUser] = await fastify.drizzle
          .select()
          .from(users)
          .where(eq(users.email, email.trim()))
          .limit(1);

        if (!targetUser) {
          return reply.code(404).send({ error: "User not found" });
        }

        // Prevent duplicate membership
        const [existing] = await fastify.drizzle
          .select()
          .from(memberships)
          .where(and(eq(memberships.groupId, groupId), eq(memberships.userId, targetUser.userId)))
          .limit(1);

        if (existing) {
          return reply.code(400).send({ error: "User is already a member of this group" });
        }

        const memberRole = role && ["owner", "admin", "leader", "member"].includes(role)
          ? role
          : "member";

        const [newMembership] = await fastify.drizzle
          .insert(memberships)
          .values({
            groupId,
            userId: targetUser.userId,
            role: memberRole,
          })
          .returning();

        return reply.code(201).send({
          data: {
            groupId: newMembership.groupId,
            userId: newMembership.userId,
            email: targetUser.email,
            role: newMembership.role,
          },
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: "Failed to add member" });
      }
    }
  );

  // Remove a member from the group (kick) – owner/admin/leader only; cannot kick owner
  fastify.delete(
    "/api/groups/:groupId/members/:userId",
    {
      schema: removeGroupMemberRouteSchema,
      preHandler: [verifyAccessToken],
    },
    async (request, reply) => {
      try {
        if (!fastify.drizzle) {
          return reply.code(500).send({ error: "Database not available" });
        }

        const authRequest = request as AuthenticatedRequest;
        if (!authRequest.user) {
          return reply.code(401).send({ error: "Unauthorized" });
        }

        const requesterId = authRequest.user.userId;
        const { groupId, userId: targetUserId } = request.params as { groupId: string; userId: string };

        if (requesterId === targetUserId) {
          return reply.code(400).send({ error: "Use Leave group to remove yourself" });
        }

        const [requesterMembership] = await fastify.drizzle
          .select()
          .from(memberships)
          .where(and(eq(memberships.groupId, groupId), eq(memberships.userId, requesterId)))
          .limit(1);

        if (!requesterMembership) {
          return reply.code(403).send({ error: "You are not a member of this group" });
        }

        const allowedRoles = new Set(["owner", "admin", "leader"]);
        if (!allowedRoles.has(requesterMembership.role)) {
          return reply.code(403).send({ error: "Insufficient permissions to remove members" });
        }

        const [targetMembership] = await fastify.drizzle
          .select()
          .from(memberships)
          .where(and(eq(memberships.groupId, groupId), eq(memberships.userId, targetUserId)))
          .limit(1);

        if (!targetMembership) {
          return reply.code(404).send({ error: "Member not found in this group" });
        }

        if (targetMembership.role === "owner") {
          return reply.code(403).send({ error: "Cannot remove the group owner" });
        }

        await fastify.drizzle
          .delete(memberships)
          .where(and(eq(memberships.groupId, groupId), eq(memberships.userId, targetUserId)));

        return reply.code(200).send({ message: "Member removed successfully" });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: "Failed to remove member" });
      }
    }
  );

  // Leave group – current user removes themselves
  fastify.post(
    "/api/groups/:groupId/leave",
    {
      schema: leaveGroupRouteSchema,
      preHandler: [verifyAccessToken],
    },
    async (request, reply) => {
      try {
        if (!fastify.drizzle) {
          return reply.code(500).send({ error: "Database not available" });
        }

        const authRequest = request as AuthenticatedRequest;
        if (!authRequest.user) {
          return reply.code(401).send({ error: "Unauthorized" });
        }

        const userId = authRequest.user.userId;
        const { groupId } = request.params as { groupId: string };

        const [membership] = await fastify.drizzle
          .select()
          .from(memberships)
          .where(and(eq(memberships.groupId, groupId), eq(memberships.userId, userId)))
          .limit(1);

        if (!membership) {
          return reply.code(403).send({ error: "You are not a member of this group" });
        }

        if (membership.role === "owner") {
          const ownerCount = await fastify.drizzle
            .select()
            .from(memberships)
            .where(and(eq(memberships.groupId, groupId), eq(memberships.role, "owner")));
          if (ownerCount.length <= 1) {
            return reply.code(400).send({
              error: "Owner cannot leave. Transfer ownership or delete the group first.",
            });
          }
        }

        await fastify.drizzle
          .delete(memberships)
          .where(and(eq(memberships.groupId, groupId), eq(memberships.userId, userId)));

        return reply.code(200).send({ message: "Left group successfully" });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: "Failed to leave group" });
      }
    }
  );

  // Update a group (owner can update)
  fastify.put(
    "/api/groups/:groupId",
    {
      schema: updateGroupRouteSchema,
      preHandler: [verifyAccessToken],
    },
    async (request, reply) => {
      try {
        if (!fastify.drizzle) {
          return reply.code(500).send({ error: "Database not available" });
        }

        const authRequest = request as AuthenticatedRequest;
        if (!authRequest.user) {
          return reply.code(401).send({ error: "Unauthorized" });
        }

        const requesterId = authRequest.user.userId;
        const { groupId } = request.params as { groupId: string };
        const body = request.body as { name?: string; description?: string };

        // Check if requester is the owner of the group
        const [ownership] = await fastify.drizzle
          .select()
          .from(memberships)
          .where(
            and(
              eq(memberships.groupId, groupId),
              eq(memberships.userId, requesterId),
              eq(memberships.role, "owner")
            )
          )
          .limit(1);

        if (!ownership) {
          return reply.code(403).send({ error: "Only group owner can update the group" });
        }

        const updateData: { name?: string; description?: string | null } = {};
        if (body.name !== undefined && body.name.trim().length > 0) {
          updateData.name = body.name.trim();
        }
        if (body.description !== undefined) {
          updateData.description = body.description ? body.description.trim() : null;
        }

        if (Object.keys(updateData).length === 0) {
          return reply.code(400).send({ error: "No fields to update" });
        }

        const [updatedGroup] = await fastify.drizzle
          .update(groups)
          .set(updateData)
          .where(eq(groups.groupId, groupId))
          .returning();

        return reply.code(200).send({ data: updatedGroup });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: "Failed to update group" });
      }
    }
  );

  // Delete a group (only owner can delete)
  fastify.delete(
    "/api/groups/:groupId",
    {
      schema: deleteGroupRouteSchema,
      preHandler: [verifyAccessToken],
    },
    async (request, reply) => {
      try {
        if (!fastify.drizzle) {
          return reply.code(500).send({ error: "Database not available" });
        }

        const authRequest = request as AuthenticatedRequest;
        if (!authRequest.user) {
          return reply.code(401).send({ error: "Unauthorized" });
        }

        const requesterId = authRequest.user.userId;
        const { groupId } = request.params as { groupId: string };

        // Check if requester is the owner of the group
        const [ownership] = await fastify.drizzle
          .select()
          .from(memberships)
          .where(
            and(
              eq(memberships.groupId, groupId),
              eq(memberships.userId, requesterId),
              eq(memberships.role, "owner")
            )
          )
          .limit(1);

        if (!ownership) {
          return reply.code(403).send({ error: "Only group owner can delete the group" });
        }

        // Delete all memberships associated with this group
        await fastify.drizzle
          .delete(memberships)
          .where(eq(memberships.groupId, groupId));

        // Delete the group
        await fastify.drizzle
          .delete(groups)
          .where(eq(groups.groupId, groupId));

        return reply.code(200).send({ message: "Group deleted successfully" });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: "Failed to delete group" });
      }
    }
  );
};

export default groupsRoutes;
