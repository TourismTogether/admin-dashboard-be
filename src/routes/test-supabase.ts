import { FastifyPluginAsync } from "fastify";

const testSupabase: FastifyPluginAsync = async (fastify) => {
  // Test Supabase connection
  fastify.get("/test/supabase", async (request, reply) => {
    try {
      // Access Supabase client in a type-safe way for Fastify
      const supabase = (fastify as any).supabase;

      // Check if Supabase client is available
      if (!supabase) {
        return reply.status(500).send({
          success: false,
          error: "Supabase client is not initialized",
          message:
            "Please check your .env file and ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) are set",
        });
      }

      // Test connection by making a simple query to check if we can reach Supabase
      // We'll use a query that works even if tables don't exist
      // Try to get schema information or just verify the connection works
      const { data, error } = await supabase.rpc("version").single();

      // If RPC doesn't work, try a simple select that will fail gracefully
      if (error) {
        // Try a different approach - just check if we can make a request
        // Query a non-existent table to test connection (will fail but show connection works)
        const testQuery = await supabase
          .from("__connection_test__")
          .select("*")
          .limit(1);

        // If we get a "table not found" error, connection is working!
        if (testQuery.error) {
          const errorCode = testQuery.error.code;
          const errorMessage = testQuery.error.message;

          // PGRST205 = relation not found (table doesn't exist) - this means connection works!
          // PGRST116 = schema not found - also means connection works
          if (
            errorCode === "PGRST205" ||
            errorCode === "PGRST116" ||
            errorMessage.includes("relation") ||
            errorMessage.includes("does not exist") ||
            errorMessage.includes("schema cache")
          ) {
            return {
              success: true,
              message: "Supabase connection successful! ✅",
              connectionStatus: "connected",
              note: "Connection test passed. The error about table not found is expected - it confirms we can communicate with Supabase.",
              supabaseUrl: process.env.SUPABASE_URL
                ? "configured"
                : "not configured",
              keyType: process.env.SUPABASE_SERVICE_ROLE_KEY
                ? "service_role"
                : process.env.SUPABASE_ANON_KEY
                ? "anon"
                : "not configured",
            };
          } else {
            // Other error - might be connection issue
            return reply.status(500).send({
              success: false,
              message: "Supabase connection error",
              connectionStatus: "error",
              error: errorMessage,
              code: errorCode,
            });
          }
        }
      }

      // If we got here, the RPC call worked (unlikely but possible)
      return {
        success: true,
        message: "Supabase connection successful! ✅",
        connectionStatus: "connected",
        data: data,
        supabaseUrl: process.env.SUPABASE_URL ? "configured" : "not configured",
        keyType: process.env.SUPABASE_SERVICE_ROLE_KEY
          ? "service_role"
          : process.env.SUPABASE_ANON_KEY
          ? "anon"
          : "not configured",
      };
    } catch (err: any) {
      fastify.log.error({ err }, "Error testing Supabase connection");
      return reply.status(500).send({
        success: false,
        message: "Error testing Supabase connection",
        error: err.message,
        connectionStatus: "error",
      });
    }
  });

  // Check Supabase configuration status
  fastify.get("/test/supabase/config", async (request, reply) => {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const anonKey = process.env.SUPABASE_ANON_KEY;

    return {
      configured: !!(supabaseUrl && (serviceRoleKey || anonKey)),
      hasUrl: !!supabaseUrl,
      hasServiceRoleKey: !!serviceRoleKey,
      hasAnonKey: !!anonKey,
      keyType: serviceRoleKey ? "service_role" : anonKey ? "anon" : "none",
      urlPreview: supabaseUrl
        ? `${supabaseUrl.substring(0, 20)}...`
        : "not set",
      message:
        supabaseUrl && (serviceRoleKey || anonKey)
          ? "Supabase is configured"
          : "Supabase is not configured. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) in your .env file",
    };
  });
};

export default testSupabase;
