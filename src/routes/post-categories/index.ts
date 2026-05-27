import { FastifyPluginAsync } from "fastify";
import { desc, eq } from "drizzle-orm";
import { postCategories, userAdmin } from "../../db/schema";
import { verifyAccessToken, AuthenticatedRequest } from "../auth/auth";
import {
  listPostCategoriesRouteSchema,
  createPostCategoryRouteSchema,
  updatePostCategoryRouteSchema,
  deletePostCategoryRouteSchema,
} from "./schemas";

async function isAdmin(drizzleDb: any, userId: string): Promise<boolean> {
  const [row] = await drizzleDb
    .select({ adminId: userAdmin.adminId })
    .from(userAdmin)
    .where(eq(userAdmin.userId, userId))
    .limit(1);
  return !!row;
}

const postCategoryRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/api/post-categories",
    {
      schema: listPostCategoriesRouteSchema,
      preHandler: [verifyAccessToken],
    },
    async (request, reply) => {
      try {
        if (!fastify.drizzle) {
          return reply.status(500).send({ error: "Database not available" });
        }
        const list = await fastify.drizzle
          .select()
          .from(postCategories)
          .orderBy(desc(postCategories.createdAt));

        return { data: list };
      } catch (error: any) {
        fastify.log.error({ err: error }, "Error listing categories");
        return reply.status(500).send({
          error: process.env.NODE_ENV === "production" ? "Internal server error" : error.message,
        });
      }
    },
  );

  fastify.post(
    "/api/post-categories",
    {
      schema: createPostCategoryRouteSchema,
      preHandler: [verifyAccessToken],
    },
    async (request, reply) => {
      try {
        const authRequest = request as AuthenticatedRequest;
        if (!authRequest.user) return reply.status(401).send({ error: "Unauthorized" });

        const admin = await isAdmin(fastify.drizzle, authRequest.user.userId);
        if (!admin) return reply.status(403).send({ error: "Admin only" });

        const body = request.body as { name: string };
        const categoryName = body.name.trim();

        const [created] = await fastify.drizzle
          .insert(postCategories)
          .values({
            name: categoryName,
          })
          .returning();

        return reply.status(201).send({ data: created });
      } catch (error: any) {
        fastify.log.error({ err: error }, "Error creating category");
        return reply.status(500).send({
          error: process.env.NODE_ENV === "production" ? "Internal server error" : error.message,
        });
      }
    },
  );

  fastify.put(
    "/api/post-categories/:categoryId",
    {
      schema: updatePostCategoryRouteSchema,
      preHandler: [verifyAccessToken],
    },
    async (request, reply) => {
      try {
        const authRequest = request as AuthenticatedRequest;
        if (!authRequest.user) return reply.status(401).send({ error: "Unauthorized" });

        const admin = await isAdmin(fastify.drizzle, authRequest.user.userId);
        if (!admin) return reply.status(403).send({ error: "Admin only" });

        const { categoryId } = request.params as { categoryId: string };
        const body = request.body as { name: string };

        const [updated] = await fastify.drizzle
          .update(postCategories)
          .set({
            name: body.name.trim(),
            updatedAt: new Date(),
          })
          .where(eq(postCategories.categoryId, categoryId))
          .returning();

        if (!updated) return reply.status(404).send({ error: "Category not found" });
        return { data: updated };
      } catch (error: any) {
        fastify.log.error({ err: error }, "Error updating category");
        return reply.status(500).send({
          error: process.env.NODE_ENV === "production" ? "Internal server error" : error.message,
        });
      }
    },
  );

  fastify.delete(
    "/api/post-categories/:categoryId",
    {
      schema: deletePostCategoryRouteSchema,
      preHandler: [verifyAccessToken],
    },
    async (request, reply) => {
      try {
        const authRequest = request as AuthenticatedRequest;
        if (!authRequest.user) return reply.status(401).send({ error: "Unauthorized" });

        const admin = await isAdmin(fastify.drizzle, authRequest.user.userId);
        if (!admin) return reply.status(403).send({ error: "Admin only" });

        const { categoryId } = request.params as { categoryId: string };
        const [deleted] = await fastify.drizzle
          .delete(postCategories)
          .where(eq(postCategories.categoryId, categoryId))
          .returning({ categoryId: postCategories.categoryId });

        if (!deleted) return reply.status(404).send({ error: "Category not found" });
        return { message: "Category deleted" };
      } catch (error: any) {
        fastify.log.error({ err: error }, "Error deleting category");
        return reply.status(500).send({
          error: process.env.NODE_ENV === "production" ? "Internal server error" : error.message,
        });
      }
    },
  );
};

export default postCategoryRoutes;
