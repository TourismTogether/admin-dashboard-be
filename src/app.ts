import AutoLoad, { AutoloadPluginOptions } from "@fastify/autoload";
import fastify, {
  FastifyError,
  FastifyPluginAsync,
  FastifyServerOptions,
} from "fastify";
import { join } from "path";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import pino from "pino";
import pinoPretty from "pino-pretty";

// Configure logger - only warn and error by default (set LOG_LEVEL to override)
const logger = pino(
  {
    level: process.env.LOG_LEVEL || "warn",
  },
  process.env.NODE_ENV === "production"
    ? undefined
    : pinoPretty({
        translateTime: "HH:MM:ss Z",
        ignore: "pid,hostname",
      }),
);

export interface AppOptions
  extends FastifyServerOptions, Partial<AutoloadPluginOptions> {}

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
  // Allow empty body for DELETE requests
  bodyLimit: 1048576, // 1MB
};

const app: FastifyPluginAsync<AppOptions> = async (
  fastify,
  opts,
): Promise<void> => {
  // Configure CORS: use CORS_ALLOWED_ORIGINS in production (comma-separated)
  const isDevelopment = process.env.NODE_ENV !== "production";
  const envOrigins = (process.env.CORS_ALLOWED_ORIGINS || "")
    .split(",")
    .map((o) => o.trim().toLowerCase())
    .filter(Boolean);
  const defaultOrigins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://localhost:8081",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "http://127.0.0.1:5175",
    "http://127.0.0.1:8081",
    // Vercel frontend (origin = scheme + host only, no path; add more via CORS_ALLOWED_ORIGINS)
    "https://admin-dashboard-fe-six.vercel.app",
  ];
  const allowedOrigins = new Set(
    [...defaultOrigins, ...envOrigins].map((origin) => origin.toLowerCase()),
  );

  await fastify.register(cors, {
    credentials: true,
    strictPreflight: false, // Allow preflight to pass through even if origin is not in list initially
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    origin: (origin, cb) => {
      // Allow requests with no origin (same-origin requests, Postman, etc.)
      if (!origin) {
        fastify.log.debug("CORS: Allowing request with no origin");
        return cb(null, true);
      }

      const normalizedOrigin = origin.toLowerCase();

      // In development, allow all localhost origins
      if (isDevelopment) {
        if (
          normalizedOrigin.startsWith("http://localhost:") ||
          normalizedOrigin.startsWith("http://127.0.0.1:")
        ) {
          fastify.log.debug(
            { origin: normalizedOrigin },
            "CORS: Allowed localhost origin (dev mode)",
          );
          return cb(null, origin);
        }
      }

      if (allowedOrigins.has(normalizedOrigin)) {
        fastify.log.debug({ origin: normalizedOrigin }, "CORS: Allowed origin");
        return cb(null, origin);
      }

      fastify.log.warn({ origin: normalizedOrigin }, "CORS: Blocked origin");
      return cb(null, false);
    },
  });

  // Rate limit: reduce brute-force and abuse (tune RATE_LIMIT_MAX / RATE_LIMIT_WINDOW_MS in production)
  await fastify.register(rateLimit, {
    max: parseInt(process.env.RATE_LIMIT_MAX || "100", 10),
    timeWindow: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "60000", 10), // 1 minute
    allowList: process.env.RATE_LIMIT_ALLOW_IP
      ? process.env.RATE_LIMIT_ALLOW_IP.split(",").map((ip) => ip.trim())
      : undefined,
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
        "Authentication error",
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
        "Request validation error",
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
            err: {
              name: error.name,
              message: error.message,
              code: (error as any).code,
            },
          },
          "Handled 4xx error",
        );
      } else {
        fastify.log.error(error);
      }
      const is5xx = (error.statusCode as number) >= 500;
      const safeMessage =
        is5xx && process.env.NODE_ENV === "production"
          ? "An unexpected error occurred"
          : error.message;
      reply.status(error.statusCode).send({
        error: (error as any).code || "error",
        message: safeMessage,
      });
    } else {
      fastify.log.error(error);
      // Default error response (never leak internal details in production)
      reply.status(500).send({
        error: "Internal Server Error",
        message:
          process.env.NODE_ENV === "production"
            ? "An unexpected error occurred"
            : error.message,
      });
    }
  });

  // Avoid body/content-type validation for methods without body or when content-type is missing/invalid
  fastify.addHook("onRequest", async (request) => {
    const contentType = request.headers["content-type"];
    const noBodyMethod =
      request.method === "GET" ||
      request.method === "HEAD" ||
      request.method === "OPTIONS";
    const invalidContentType =
      contentType === undefined ||
      contentType === null ||
      String(contentType).toLowerCase() === "undefined";
    const deleteForDelete =
      request.method === "DELETE" &&
      (invalidContentType || contentType?.includes("application/json"));
    if (noBodyMethod || invalidContentType || deleteForDelete) {
      delete request.headers["content-type"];
    }
  });

  fastify.addHook("onClose", async () => {
    console.log("Server is closing");
  });

  // @deprecated - Server will mainly be shut down, email sending is now manual via API endpoint
  // Schedule weekly personal tasks email job after server is ready
  // fastify.ready().then(() => {
  //   const { scheduleWeeklyPersonalTasksEmailJob } = require("./jobs/weeklyPersonalTasksEmail");
  //   scheduleWeeklyPersonalTasksEmailJob(fastify);
  //   fastify.log.info("[app] Weekly personal tasks email job scheduled");
  // });

  // This loads all plugins defined in plugins
  // those should be support plugins that are reused
  // through your application
  void fastify.register(AutoLoad, {
    dir: join(__dirname, "plugins"),
    options: opts,
  });

  // This loads all plugins defined in routes
  void fastify.register(AutoLoad, {
    dir: join(__dirname, "routes"),
    options: opts,
  });

  // Manually register routes from subdirectories (ensures correct path /api/*)
  const authRoutes = (await import("./routes/auth/index.js")).default as unknown as FastifyPluginAsync;
  const personalTasksRoutes = (await import("./routes/personal-tasks/index.js")).default as unknown as FastifyPluginAsync;
  const groupTasksRoutes = (await import("./routes/group-tasks/index.js")).default as unknown as FastifyPluginAsync;
  const groupsRoutes = (await import("./routes/groups/index.js")).default as unknown as FastifyPluginAsync;
  const meetingRoutes = (await import("./routes/meetings/index.js")).default as unknown as FastifyPluginAsync;
  const portfolioRoutes = (await import("./routes/portfolio/index.js")).default as unknown as FastifyPluginAsync;
  const settingsRoutes = (await import("./routes/settings/index.js")).default as unknown as FastifyPluginAsync;
  const brainstormRoutes = (await import("./routes/brainstorm/index.js")).default as unknown as FastifyPluginAsync;
  const feedbackRoutes = (await import("./routes/feedback/index.js")).default as unknown as FastifyPluginAsync;
  const shareRoutes = (await import("./routes/share/index.js")).default as unknown as FastifyPluginAsync;

  await fastify.register(authRoutes);
  await fastify.register(personalTasksRoutes);
  await fastify.register(groupsRoutes);
  await fastify.register(groupTasksRoutes);
  await fastify.register(portfolioRoutes);
  await fastify.register(settingsRoutes);
  await fastify.register(meetingRoutes);
  await fastify.register(brainstormRoutes);
  await fastify.register(feedbackRoutes);
  await fastify.register(shareRoutes);
};

export default app;
export { app, options };
