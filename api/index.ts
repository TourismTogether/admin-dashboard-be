/**
 * Vercel Serverless Function entry.
 * Vercel runs files in /api as functions; this handler creates Fastify,
 * registers the app plugin, and forwards (req, res) to Fastify.
 */
import "dotenv/config";
import Fastify from "fastify";
import app, { options } from "../src/app";

const server = Fastify(options);
server.register(app);

export default async function handler(req: any, res: any): Promise<void> {
  await server.ready();
  server.server.emit("request", req, res);
}
