import { FastifyPluginAsync } from "fastify";
import { and, desc, eq } from "drizzle-orm";
import { latexDocuments } from "../../db/schema";
import { AuthenticatedRequest, verifyAccessToken } from "../auth/auth";
import {
  compileLatexRouteSchema,
  createLatexDocumentRouteSchema,
  deleteLatexDocumentRouteSchema,
  getLatexDocumentRouteSchema,
  getLatexDocumentsRouteSchema,
  updateLatexDocumentRouteSchema,
} from "./schemas";

const LATEX_API_BASE_URL =
  process.env.LATEX_API_BASE_URL || "https://api.formatex.io";
const LATEX_API_KEY = process.env.FORMATEX_API_KEY;
const LATEX_ENGINE = process.env.LATEX_ENGINE || "pdflatex";

class LatexCompileError extends Error {
  code: string;
  statusCode: number;

  constructor(message: string, code: string, statusCode: number) {
    super(message);
    this.name = "LatexCompileError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

async function compileLatex(content: string) {
  if (!LATEX_API_KEY) {
    throw new LatexCompileError(
      "Missing FORMATEX_API_KEY environment variable",
      "latex_provider_not_configured",
      500,
    );
  }

  const compileRes = await fetch(
    `${LATEX_API_BASE_URL}/api/v1/compile`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": LATEX_API_KEY,
      },
      body: JSON.stringify({
        latex: content,
        engine: LATEX_ENGINE,
      }),
    },
  );

  if (!compileRes.ok) {
    const responseText = await compileRes.text();
    if (compileRes.status === 401) {
      throw new LatexCompileError(
        "FormaTeX rejected FORMATEX_API_KEY",
        "latex_provider_auth_failed",
        502,
      );
    }
    if (compileRes.status === 403) {
      throw new LatexCompileError(
        "Latex compilation quota has been reached",
        "latex_quota_exceeded",
        503,
      );
    }
    if (compileRes.status === 429) {
      throw new LatexCompileError(
        "Latex compilation service is temporarily busy",
        "latex_rate_limited",
        503,
      );
    }
    throw new LatexCompileError(
      [
        `LaTeX API request failed with status ${compileRes.status}`,
        responseText,
      ]
        .filter(Boolean)
        .join("\n"),
      "latex_provider_failed",
      502,
    );
  }

  const pdfBuffer = Buffer.from(await compileRes.arrayBuffer());
  return {
    pdfBase64: pdfBuffer.toString("base64"),
    log: "",
    engine: LATEX_ENGINE,
  };
}

const latexRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    "/api/latex/compile",
    { schema: compileLatexRouteSchema, preHandler: [verifyAccessToken] },
    async (request, reply) => {
      try {
        const authRequest = request as AuthenticatedRequest;
        if (!authRequest.user) {
          return reply.status(401).send({ error: "Unauthorized" });
        }
        const body = request.body as { content: string };
        const data = await compileLatex(body.content);
        return { data };
      } catch (error: unknown) {
        const err = error as Error;
        fastify.log.error({ err }, "Error compiling latex document");
        if (err instanceof LatexCompileError) {
          return reply.status(err.statusCode).send({
            error: err.code,
            message: err.message,
            log: err.message,
          });
        }
        return reply.status(400).send({
          error: "latex_compilation_failed",
          message: "LaTeX compilation failed",
          log: err.message,
        });
      }
    },
  );

  fastify.get(
    "/api/latex",
    { schema: getLatexDocumentsRouteSchema, preHandler: [verifyAccessToken] },
    async (request, reply) => {
      try {
        if (!fastify.drizzle) {
          return reply.status(500).send({ error: "Database not available" });
        }
        const authRequest = request as AuthenticatedRequest;
        if (!authRequest.user) return reply.status(401).send({ error: "Unauthorized" });

        const items = await fastify.drizzle
          .select()
          .from(latexDocuments)
          .where(eq(latexDocuments.userId, authRequest.user.userId))
          .orderBy(desc(latexDocuments.updatedAt));
        return { data: items };
      } catch (error: unknown) {
        const err = error as Error;
        fastify.log.error({ err }, "Error fetching latex documents");
        return reply.status(500).send({ error: err.message });
      }
    },
  );

  fastify.get(
    "/api/latex/:id",
    { schema: getLatexDocumentRouteSchema, preHandler: [verifyAccessToken] },
    async (request, reply) => {
      try {
        if (!fastify.drizzle) {
          return reply.status(500).send({ error: "Database not available" });
        }
        const authRequest = request as AuthenticatedRequest;
        if (!authRequest.user) return reply.status(401).send({ error: "Unauthorized" });
        const { id } = request.params as { id: string };
        const [item] = await fastify.drizzle
          .select()
          .from(latexDocuments)
          .where(
            and(
              eq(latexDocuments.id, id),
              eq(latexDocuments.userId, authRequest.user.userId),
            ),
          )
          .limit(1);
        if (!item) return reply.status(404).send({ error: "Document not found" });
        return { data: item };
      } catch (error: unknown) {
        const err = error as Error;
        fastify.log.error({ err }, "Error fetching latex document");
        return reply.status(500).send({ error: err.message });
      }
    },
  );

  fastify.post(
    "/api/latex",
    { schema: createLatexDocumentRouteSchema, preHandler: [verifyAccessToken] },
    async (request, reply) => {
      try {
        if (!fastify.drizzle) {
          return reply.status(500).send({ error: "Database not available" });
        }
        const authRequest = request as AuthenticatedRequest;
        if (!authRequest.user) return reply.status(401).send({ error: "Unauthorized" });
        const body = request.body as { title?: string; content?: string };
        const [created] = await fastify.drizzle
          .insert(latexDocuments)
          .values({
            userId: authRequest.user.userId,
            title: body.title?.trim() || "Untitled",
            content: body.content ?? "",
          })
          .returning();
        return { data: created };
      } catch (error: unknown) {
        const err = error as Error;
        fastify.log.error({ err }, "Error creating latex document");
        return reply.status(500).send({ error: err.message });
      }
    },
  );

  fastify.put(
    "/api/latex/:id",
    { schema: updateLatexDocumentRouteSchema, preHandler: [verifyAccessToken] },
    async (request, reply) => {
      try {
        if (!fastify.drizzle) {
          return reply.status(500).send({ error: "Database not available" });
        }
        const authRequest = request as AuthenticatedRequest;
        if (!authRequest.user) return reply.status(401).send({ error: "Unauthorized" });
        const { id } = request.params as { id: string };
        const body = request.body as { title?: string; content?: string };
        const [existing] = await fastify.drizzle
          .select()
          .from(latexDocuments)
          .where(
            and(
              eq(latexDocuments.id, id),
              eq(latexDocuments.userId, authRequest.user.userId),
            ),
          )
          .limit(1);
        if (!existing) return reply.status(404).send({ error: "Document not found" });

        const [updated] = await fastify.drizzle
          .update(latexDocuments)
          .set({
            ...(body.title !== undefined && {
              title: body.title.trim() || "Untitled",
            }),
            ...(body.content !== undefined && { content: body.content }),
            updatedAt: new Date(),
          })
          .where(eq(latexDocuments.id, id))
          .returning();
        return { data: updated };
      } catch (error: unknown) {
        const err = error as Error;
        fastify.log.error({ err }, "Error updating latex document");
        return reply.status(500).send({ error: err.message });
      }
    },
  );

  fastify.delete(
    "/api/latex/:id",
    { schema: deleteLatexDocumentRouteSchema, preHandler: [verifyAccessToken] },
    async (request, reply) => {
      try {
        if (!fastify.drizzle) {
          return reply.status(500).send({ error: "Database not available" });
        }
        const authRequest = request as AuthenticatedRequest;
        if (!authRequest.user) return reply.status(401).send({ error: "Unauthorized" });
        const { id } = request.params as { id: string };
        const [existing] = await fastify.drizzle
          .select()
          .from(latexDocuments)
          .where(
            and(
              eq(latexDocuments.id, id),
              eq(latexDocuments.userId, authRequest.user.userId),
            ),
          )
          .limit(1);
        if (!existing) return reply.status(404).send({ error: "Document not found" });

        await fastify.drizzle.delete(latexDocuments).where(eq(latexDocuments.id, id));
        return { message: "Document deleted successfully" };
      } catch (error: unknown) {
        const err = error as Error;
        fastify.log.error({ err }, "Error deleting latex document");
        return reply.status(500).send({ error: err.message });
      }
    },
  );
};

export default latexRoutes;
