import { FastifyPluginAsync } from "fastify";
import { desc, eq, and } from "drizzle-orm";
import { posts, userAdmin, postCategories } from "../../db/schema";
import { verifyAccessToken, AuthenticatedRequest } from "../auth/auth";
import {
  listPostsRouteSchema,
  createPostRouteSchema,
  updatePostRouteSchema,
  deletePostRouteSchema,
} from "./schemas";

async function isAdmin(drizzleDb: any, userId: string): Promise<boolean> {
  const [row] = await drizzleDb
    .select({ adminId: userAdmin.adminId })
    .from(userAdmin)
    .where(eq(userAdmin.userId, userId))
    .limit(1);
  return !!row;
}

const postRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/api/posts",
    {
      schema: listPostsRouteSchema,
      preHandler: [verifyAccessToken],
    },
    async (request, reply) => {
      try {
        if (!fastify.drizzle) {
          return reply.status(500).send({ error: "Database not available" });
        }

        const list = await fastify.drizzle
          .select()
          .from(posts)
          .orderBy(desc(posts.createdAt));

        return { data: list };
      } catch (error: any) {
        fastify.log.error({ err: error }, "Error listing posts");
        return reply.status(500).send({
          error: process.env.NODE_ENV === "production" ? "Internal server error" : error.message,
        });
      }
    },
  );

  fastify.post(
    "/api/posts",
    {
      schema: createPostRouteSchema,
      preHandler: [verifyAccessToken],
    },
    async (request, reply) => {
      try {
        if (!fastify.drizzle) {
          return reply.status(500).send({ error: "Database not available" });
        }
        const authRequest = request as AuthenticatedRequest;
        if (!authRequest.user) return reply.status(401).send({ error: "Unauthorized" });

        const body = request.body as {
          categoryId: string;
          title: string;
          content: string;
        };

        if (body.categoryId) {
          const [category] = await fastify.drizzle
            .select()
            .from(postCategories)
            .where(eq(postCategories.categoryId, body.categoryId))
            .limit(1);

          if (!category) return reply.status(400).send({ error: "Category not found" });
        }

        const [created] = await fastify.drizzle
          .insert(posts)
          .values({
            categoryId: body.categoryId,
            title: body.title.trim(),
            content: body.content,
            authorId: authRequest.user.userId,
          })
          .returning();

        return reply.status(201).send({ data: created });
      } catch (error: any) {
        fastify.log.error({ err: error }, "Error creating post");
        return reply.status(500).send({
          error: process.env.NODE_ENV === "production" ? "Internal server error" : error.message,
        });
      }
    },
  );

  fastify.put(
    "/api/posts/:postId",
    {
      schema: updatePostRouteSchema,
      preHandler: [verifyAccessToken],
    },
    async (request, reply) => {
      try {
        if (!fastify.drizzle) {
          return reply.status(500).send({ error: "Database not available" });
        }
        const authRequest = request as AuthenticatedRequest;
        if (!authRequest.user) return reply.status(401).send({ error: "Unauthorized" });

        const { postId } = request.params as { postId: string };
        const body = request.body as {
          categoryId?: string;
          title?: string;
          content?: string;
        };

        if (body.categoryId !== undefined) {
          const [category] = await fastify.drizzle
            .select()
            .from(postCategories)
            .where(eq(postCategories.categoryId, body.categoryId))
            .limit(1);

          if (!category) return reply.status(400).send({ error: "Category not found" });
        }

        const [updated] = await fastify.drizzle
          .update(posts)
          .set({
            ...(body.title !== undefined ? { title: body.title.trim() } : {}),
            ...(body.content !== undefined ? { content: body.content } : {}),
            ...(body.categoryId !== undefined ? { categoryId: body.categoryId } : {}),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(posts.postId, postId),
              eq(posts.authorId, authRequest.user.userId),
            ),
          )
          .returning();

        if (!updated) {
          return reply.status(404).send({ error: "Post not found or you are not the author" });
        }

        return { data: updated };
      } catch (error: any) {
        fastify.log.error({ err: error }, "Error updating post");
        return reply.status(500).send({
          error: process.env.NODE_ENV === "production" ? "Internal server error" : error.message,
        });
      }
    },
  );

  fastify.delete(
    "/api/posts/:postId",
    {
      schema: deletePostRouteSchema,
      preHandler: [verifyAccessToken],
    },
    async (request, reply) => {
      try {
        if (!fastify.drizzle) {
          return reply.status(500).send({ error: "Database not available" });
        }
        const authRequest = request as AuthenticatedRequest;
        if (!authRequest.user) return reply.status(401).send({ error: "Unauthorized" });

        const { postId } = request.params as { postId: string };
        const admin = await isAdmin(fastify.drizzle, authRequest.user.userId);

        const deleteCondition = admin
          ? eq(posts.postId, postId)
          : and(eq(posts.postId, postId), eq(posts.authorId, authRequest.user.userId));

        const [deleted] = await fastify.drizzle
          .delete(posts)
          .where(deleteCondition)
          .returning({ postId: posts.postId });

        if (!deleted) return reply.status(404).send({ error: "Post not found or unauthorized" });

        return { message: "Post deleted successfully" };
      } catch (error: any) {
        fastify.log.error({ err: error }, "Error deleting post");
        return reply.status(500).send({
          error: process.env.NODE_ENV === "production" ? "Internal server error" : error.message,
        });
      }
    },
  );
};

export default postRoutes;
