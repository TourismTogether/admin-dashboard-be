import { drizzle } from "drizzle-orm/node-postgres";
import { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { Pool } from "pg";
import * as schema from "../db/schema";

declare module "fastify" {
  interface FastifyInstance {
    drizzle: ReturnType<typeof drizzle>;
  }
}

const drizzlePlugin: FastifyPluginAsync = async (fastify) => {
  // Priority 1: Use DATABASE_URL if provided (connection string from Supabase Dashboard)
  const databaseUrl = process.env.DATABASE_URL;
  let connectionString: string;

  if (databaseUrl) {
    connectionString = databaseUrl.trim();
    fastify.log.info("Using DATABASE_URL from .env file");
  } else {
    // Priority 2: Use individual DATABASE_* variables
    const host = process.env.DATABASE_HOST;
    const port = process.env.DATABASE_PORT;
    const user = process.env.DATABASE_USER;
    const password = process.env.DATABASE_PASSWORD;
    const database = process.env.DATABASE_NAME;

    if (!host || !port || !user || !password || !database) {
      fastify.log.warn(
        "Database configuration is incomplete. Drizzle will not be available."
      );
      fastify.log.warn(
        "Please set DATABASE_URL or individual DATABASE_* variables in your .env file"
      );
      return;
    }

    // Build connection string from individual components
    connectionString = `postgresql://${user.trim()}:${encodeURIComponent(password.trim())}@${host.trim()}:${port.trim()}/${database.trim()}`;
  }

  // Create PostgreSQL connection pool
  const pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  // Add error handler
  pool.on("error", (err) => {
    fastify.log.error({ err }, "Unexpected error on idle database client");
  });

  // Initialize Drizzle with schema
  const db = drizzle(pool, { schema });

  fastify.decorate("drizzle", db);
  fastify.log.info("Drizzle ORM initialized successfully");

  // Graceful shutdown
  fastify.addHook("onClose", async () => {
    await pool.end();
    fastify.log.info("Database connection pool closed");
  });
};

export default fp(drizzlePlugin, {
  name: "drizzle",
});
