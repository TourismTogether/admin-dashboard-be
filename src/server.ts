import "dotenv/config";
import Fastify from "fastify";
import app, { options } from "./app";

// Initialize Fastify server
const server = Fastify(options);

// Register the main app plugin
server.register(app);

// Start the server
const start = async () => {
  try {
    const port = process.env.PORT ? parseInt(process.env.PORT.trim()) : 8081;
    const host = process.env.HOST ? process.env.HOST.trim() : "0.0.0.0";

    await server.listen({
      port,
      host,
    });
    server.log.info(`Server listening on ${host}:${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
