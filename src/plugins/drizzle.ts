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
  // Get Supabase connection string
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabasePassword = process.env.SUPABASE_DB_PASSWORD;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const directDbUrl = process.env.SUPABASE_DB_URL;

  if (!supabaseUrl && !directDbUrl) {
    fastify.log.warn(
      "Supabase URL not configured. Drizzle will not be available."
    );
    return;
  }

  let connectionString: string;

  if (directDbUrl) {
    // Use direct database URL if provided
    connectionString = directDbUrl;
  } else {
    // Parse Supabase URL to get database connection string
    const urlMatch = supabaseUrl!.match(/https?:\/\/([^.]+)\.supabase\.co/);
    if (!urlMatch) {
      fastify.log.error(
        "Invalid SUPABASE_URL format. Expected format: https://project-ref.supabase.co"
      );
      return;
    }

    const projectRef = urlMatch[1];
    const password = supabasePassword || supabaseServiceKey || "";

    if (!password) {
      fastify.log.error(
        "Either SUPABASE_DB_PASSWORD or SUPABASE_SERVICE_ROLE_KEY must be set"
      );
      return;
    }

    connectionString = `postgresql://postgres:${password}@db.${projectRef}.supabase.co:5432/postgres`;
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
