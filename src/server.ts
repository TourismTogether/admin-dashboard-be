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
    await server.listen({
      port: process.env.PORT ? parseInt(process.env.PORT) : 3000,
      host: process.env.HOST ? process.env.HOST : "0.0.0.0",
    });
    server.log.info(
      `Server listening on ${server.server.address()?.toString()}`
    );
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
