/**
 * Vercel serverless entry: creates Fastify instance, registers app plugin,
 * exports handler that forwards (req, res) to Fastify. Do not use listen() here.
 */
import "dotenv/config";
import Fastify from "fastify";
import app, { options } from "./app";

const server = Fastify(options);
server.register(app);

export default async function handler(req: any, res: any): Promise<void> {
  await server.ready();
  server.server.emit("request", req, res);
}
