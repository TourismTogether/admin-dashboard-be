import { FastifyPluginAsync } from "fastify";

const root: FastifyPluginAsync = async (fastify) => {
  fastify.get("/", async (request, reply) => {
    return {
      message: "Admin Dashboard Server",
      version: "1.0.0",
      status: "running",
    };
  });

  fastify.get("/health", async (request, reply) => {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
    };
  });
};

export default root;
