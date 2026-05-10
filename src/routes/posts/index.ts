import { FastifyPluginAsync } from "fastify";
import { desc, eq } from "drizzle-orm";
import { posts, userAdmin } from "../../db/schema";
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
                const list = await fastify.drizzle.select().from(posts).orderBy(desc(posts.createdAt));
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
                    categoryId: string,
                    title: string,
                    content: string,
                };

                // TODO: check category

                const [created] = await fastify.drizzle
                    .insert(posts)
                    .values({
                        categoryId: body.categoryId ?? null,
                        title: body.title.trim(),
                        content: body.content ?? null,
                        authorId: authRequest.user.userId,
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

                // TODO: check author

                const { postId } = request.params as { postId: string };
                const body = request.body as {
                    categoryId?: string | undefined,
                    title?: string | undefined,
                    content?: string | undefined,
                };

                const [updated] = await fastify.drizzle
                    .update(posts)
                    .set({
                        ...(body.title !== undefined ? { title: body.title.trim() } : {}),
                        ...(body.content !== undefined ? { description: body.content } : {}),
                        ...(body.categoryId !== undefined ? { detail: body.categoryId } : {}),
                        updatedAt: new Date(),
                    })
                    .where(eq(posts.postId, postId))
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

                // TODO: admin or author
                // const admin = await isAdmin(fastify.drizzle, authRequest.user.userId);
                // if (!admin) return reply.status(403).send({ error: "Admin only" });

                const { postId } = request.params as { postId: string };
                const [deleted] = await fastify.drizzle
                    .delete(posts)
                    .where(eq(posts.postId, postId))
                    .returning({ postId: posts.postId });
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

export default postRoutes;
