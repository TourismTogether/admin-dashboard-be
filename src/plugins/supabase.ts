import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

declare module "fastify" {
  interface FastifyInstance {
    supabase?: SupabaseClient;
  }
}

const supabasePlugin: FastifyPluginAsync = async (fastify) => {
  const supabaseUrl = process.env.SUPABASE_URL || "";
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "";

  if (!supabaseUrl || !supabaseKey) {
    fastify.log.warn(
      "Missing Supabase environment variables. Supabase client will not be available."
    );
    fastify.log.warn(
      "Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) in your .env file"
    );
    // Don't create a dummy client - just skip initialization
    // Routes that need Supabase should check if it's available
    return;
  }

  // Use service role key for admin operations, or anon key for client operations
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  fastify.decorate("supabase", supabase);
  fastify.log.info("Supabase client initialized successfully");
};

export default fp(supabasePlugin, {
  name: "supabase",
});
