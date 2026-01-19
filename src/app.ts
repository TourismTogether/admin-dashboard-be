import AutoLoad, { AutoloadPluginOptions } from "@fastify/autoload";
import fastify, {
  FastifyError,
  FastifyPluginAsync,
  FastifyServerOptions,
} from "fastify";
import { join } from "path";
import cors from "@fastify/cors";
import pino from "pino";
import pinoPretty from "pino-pretty";

// Configure logger
const logger = pino(
  {
    level: process.env.LOG_LEVEL || "info",
  },
  process.env.NODE_ENV === "production"
    ? undefined
    : pinoPretty({
        translateTime: "HH:MM:ss Z",
        ignore: "pid,hostname",
      })
);

export interface AppOptions
  extends FastifyServerOptions,
    Partial<AutoloadPluginOptions> {}

// Pass --options via CLI arguments in command to enable these options.
const options: AppOptions = {
  loggerInstance: logger,
  connectionTimeout: 30000, // 30 seconds
  requestTimeout: 30000, // 30 seconds
  disableRequestLogging: false,
  // Trust proxies to get the real client IP from X-Forwarded-For headers
  trustProxy: true,
  // Increase plugin timeout to handle slow connections during startup
  pluginTimeout: 60000, // 60 seconds
};

const app: FastifyPluginAsync<AppOptions> = async (
  fastify,
  opts
): Promise<void> => {
  // Configure CORS
  const allowedOrigins = new Set(
    [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:5175",
      // Add production origins here
    ].map((origin) => origin.toLowerCase())
  );

  await fastify.register(cors, {
    credentials: true,
    strictPreflight: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
    ],
    origin: (origin, cb) => {
      if (!origin) {
        return cb(null, false);
      }

      if (allowedOrigins.has(origin.toLowerCase())) {
        return cb(null, origin);
      }

      fastify.log.debug({ origin }, "Blocked CORS origin");
      return cb(null, false);
    },
  });

  fastify.addHook("onSend", async (request, reply, payload) => {
    if (!reply.hasHeader("access-control-allow-origin")) {
      const origin = request.headers.origin;
      if (origin && allowedOrigins.has(origin.toLowerCase())) {
        reply.header("access-control-allow-origin", origin);
        reply.header("access-control-allow-credentials", "true");
        reply.header("vary", "Origin");
      }
    }
    return payload;
  });

  // Error handler
  fastify.setErrorHandler((error: FastifyError, request, reply) => {
    // Handle AuthenticationError
    if ((error as any).authMethod) {
      const authError = error as any;
      fastify.log.warn(
        {
          err: {
            name: error.name,
            message: error.message,
            code: authError.code,
            authMethod: authError.authMethod,
          },
        },
        "Authentication error"
      );
      return reply.status(authError.statusCode || 401).send({
        error: authError.code || "auth_error",
        message: authError.message,
        authMethod: authError.authMethod,
      });
    }

    if (error.validation) {
      // Handle Fastify's validation errors (client-side)
      fastify.log.warn(
        { err: { name: error.name, message: error.message } },
        "Request validation error"
      );
      reply.status(error.statusCode || 400).send({
        error: "Validation error",
        message: error.message,
        details: error.validation,
      });
    } else if (error.statusCode) {
      // For other known status codes
      if ((error.statusCode as number) < 500) {
        fastify.log.warn(
          {
            err: { name: error.name, message: error.message, code: (error as any).code },
          },
          "Handled 4xx error"
        );
      } else {
        fastify.log.error(error);
      }
      reply.status(error.statusCode).send({
        error: (error as any).code || "error",
        message: error.message,
      });
    } else {
      fastify.log.error(error);
      // Default error response
      reply.status(500).send({
        error: "Internal Server Error",
        message: "An unexpected error occurred",
      });
    }
  });

  fastify.addHook("onClose", async () => {
    console.log("Server is closing");
  });

  // This loads all plugins defined in plugins
  // those should be support plugins that are reused
  // through your application
  void fastify.register(AutoLoad, {
    dir: join(__dirname, "plugins"),
    options: opts,
  });

  // This loads all plugins defined in routes
  // define your routes in one of these
  void fastify.register(AutoLoad, {
    dir: join(__dirname, "routes"),
    options: opts,
  });
};

export default app;
export { app, options };
