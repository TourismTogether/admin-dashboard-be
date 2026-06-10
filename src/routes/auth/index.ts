import bcrypt from "bcrypt";
import { FastifyPluginAsync } from "fastify";
import { eq } from "drizzle-orm";
import { users, userAdmin } from "../../db/schema";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  verifyAccessToken,
  AuthenticationError,
  AuthenticatedRequest,
} from "./auth";
import {
  registerRouteSchema,
  loginRouteSchema,
  meRouteSchema,
  refreshRouteSchema,
  logoutRouteSchema,
} from "./schemas";

const saltRounds = 10;
const MIN_PASSWORD_LENGTH = 8;
const REFRESH_TOKEN_COOKIE = "refresh_token";

function getCookie(request: { headers: { cookie?: string } }, name: string) {
  const cookies = request.headers.cookie?.split(";") || [];
  for (const cookie of cookies) {
    const [cookieName, ...valueParts] = cookie.trim().split("=");
    if (cookieName === name) {
      return decodeURIComponent(valueParts.join("="));
    }
  }
  return undefined;
}

function buildRefreshCookie(token: string, maxAge: number) {
  const isProduction = process.env.NODE_ENV === "production";
  return [
    `${REFRESH_TOKEN_COOKIE}=${encodeURIComponent(token)}`,
    "HttpOnly",
    "Path=/api/auth",
    `Max-Age=${maxAge}`,
    isProduction ? "SameSite=None" : "SameSite=Lax",
    ...(isProduction ? ["Secure"] : []),
  ].join("; ");
}

function getRefreshCookie(token: string) {
  const configuredMaxAge = Number.parseInt(
    process.env.REFRESH_TOKEN_COOKIE_MAX_AGE_SECONDS || "2592000",
    10
  );
  const maxAge = Number.isFinite(configuredMaxAge)
    ? configuredMaxAge
    : 2592000;
  return buildRefreshCookie(token, maxAge);
}

function getClearedRefreshCookie() {
  return buildRefreshCookie("", 0);
}

async function issueTokens(userId: string, email: string) {
  const [accessToken, refreshToken] = await Promise.all([
    generateAccessToken(userId, email),
    generateRefreshToken(userId, email),
  ]);
  return { accessToken, refreshToken };
}

const validatePassword = (password: string) => {
  const hasMinLength = password.length >= MIN_PASSWORD_LENGTH;
  const hasLowercase = /[a-z]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

  const isValid = hasMinLength && hasLowercase && hasUppercase && hasSpecialChar;

  if (!isValid) {
    return {
      isValid,
      errorMessage: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long, contain at least one lowercase letter, one uppercase letter, and one special character.`,
    };
  }

  return { isValid, errorMessage: null };
};

async function checkIsAdmin(drizzleDb: any, userId: string): Promise<boolean> {
  const [row] = await drizzleDb
    .select({ adminId: userAdmin.adminId })
    .from(userAdmin)
    .where(eq(userAdmin.userId, userId))
    .limit(1);
  return !!row;
}

const auth: FastifyPluginAsync = async (fastify) => {
  // Register endpoint
  fastify.post(
    "/api/auth/register",
    { schema: registerRouteSchema },
    async (request, reply) => {
      try {
        if (!fastify.drizzle) {
          return reply.status(500).send({ error: "Database not available" });
        }

        const body = request.body as {
          email: string;
          password: string;
          account: string;
          nickname?: string;
          fullname?: string;
        };

        // Validate email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(body.email)) {
          return reply.status(400).send({ error: "Invalid email format" });
        }

        // Validate password
        const passwordValidation = validatePassword(body.password);
        if (!passwordValidation.isValid) {
          return reply.status(400).send({ error: passwordValidation.errorMessage });
        }

        // Check if user already exists
        const [existingUser] = await fastify.drizzle
          .select()
          .from(users)
          .where(eq(users.email, body.email))
          .limit(1);

        if (existingUser) {
          return reply.status(409).send({ error: "User with this email already exists" });
        }

        // Check if account already exists
        const [existingAccount] = await fastify.drizzle
          .select()
          .from(users)
          .where(eq(users.account, body.account))
          .limit(1);

        if (existingAccount) {
          return reply.status(409).send({ error: "Account name already taken" });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(body.password, saltRounds);

        // Create user
        const [newUser] = await fastify.drizzle
          .insert(users)
          .values({
            email: body.email,
            account: body.account,
            password: hashedPassword,
            nickname: body.nickname,
            fullname: body.fullname,
          })
          .returning();

        const { accessToken, refreshToken } = await issueTokens(
          newUser.userId,
          newUser.email
        );
        const isAdmin = await checkIsAdmin(fastify.drizzle!, newUser.userId);

        return reply
          .header("Set-Cookie", getRefreshCookie(refreshToken))
          .status(201)
          .send({
            access_token: accessToken,
            user: {
              userId: newUser.userId,
              email: newUser.email,
              account: newUser.account,
              nickname: newUser.nickname,
              fullname: newUser.fullname,
              isAdmin,
            },
          });
      } catch (error: any) {
        fastify.log.error({ err: error }, "Error registering user");
        return reply.status(500).send({
          error: process.env.NODE_ENV === "production" ? "Internal server error" : (error.message || "Internal server error"),
        });
      }
    }
  );

  // Login endpoint
  fastify.post(
    "/api/auth/login",
    { schema: loginRouteSchema },
    async (request, reply) => {
      try {
        if (!fastify.drizzle) {
          return reply.status(500).send({ error: "Database not available" });
        }

        const body = request.body as {
          email: string;
          password: string;
        };

        // Find user by email
        const [user] = await fastify.drizzle
          .select()
          .from(users)
          .where(eq(users.email, body.email))
          .limit(1);

        if (!user) {
          return reply.status(401).send({ error: "Invalid email or password" });
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(body.password, user.password);
        if (!isPasswordValid) {
          return reply.status(401).send({ error: "Invalid email or password" });
        }

        const { accessToken, refreshToken } = await issueTokens(
          user.userId,
          user.email
        );
        const isAdmin = await checkIsAdmin(fastify.drizzle!, user.userId);

        return reply
          .header("Set-Cookie", getRefreshCookie(refreshToken))
          .send({
            access_token: accessToken,
            user: {
              userId: user.userId,
              email: user.email,
              account: user.account,
              nickname: user.nickname,
              fullname: user.fullname,
              isAdmin,
            },
          });
      } catch (error: any) {
        fastify.log.error({ err: error }, "Error logging in");
        return reply.status(500).send({
          error: process.env.NODE_ENV === "production" ? "Internal server error" : (error.message || "Internal server error"),
        });
      }
    }
  );

  fastify.post(
    "/api/auth/refresh",
    { schema: refreshRouteSchema },
    async (request, reply) => {
      try {
        if (!fastify.drizzle) {
          return reply.status(500).send({ error: "Database not available" });
        }

        const refreshToken = getCookie(request, REFRESH_TOKEN_COOKIE);
        if (!refreshToken) {
          return reply.status(401).send({
            error: "Refresh token not found",
            code: "auth_no_refresh_token",
          });
        }

        const tokenUser = await verifyRefreshToken(refreshToken);
        const [user] = await fastify.drizzle
          .select({
            userId: users.userId,
            email: users.email,
          })
          .from(users)
          .where(eq(users.userId, tokenUser.userId))
          .limit(1);

        if (!user) {
          return reply
            .header("Set-Cookie", getClearedRefreshCookie())
            .status(401)
            .send({
              error: "User not found",
              code: "auth_user_not_found",
            });
        }

        const tokens = await issueTokens(user.userId, user.email);
        return reply
          .header("Set-Cookie", getRefreshCookie(tokens.refreshToken))
          .send({ access_token: tokens.accessToken });
      } catch (error) {
        if (error instanceof AuthenticationError) {
          return reply
            .header("Set-Cookie", getClearedRefreshCookie())
            .status(error.statusCode)
            .send({
              error: error.message,
              code: error.code,
            });
        }
        fastify.log.error({ err: error }, "Error refreshing token");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  fastify.post(
    "/api/auth/logout",
    { schema: logoutRouteSchema },
    async (_request, reply) => {
      return reply
        .header("Set-Cookie", getClearedRefreshCookie())
        .status(204)
        .send();
    }
  );

  // Get current user endpoint
  fastify.get(
    "/api/auth/me",
    {
      schema: meRouteSchema,
      preHandler: [verifyAccessToken],
    },
    async (request, reply) => {
      try {
        const authRequest = request as AuthenticatedRequest;
        if (!authRequest.user) {
          return reply.status(401).send({ error: "Unauthorized" });
        }

        if (!fastify.drizzle) {
          return reply.status(500).send({ error: "Database not available" });
        }

        const [user] = await fastify.drizzle
          .select({
            userId: users.userId,
            email: users.email,
            account: users.account,
            nickname: users.nickname,
            fullname: users.fullname,
            imageUrl: users.imageUrl,
            createdAt: users.createdAt,
            updatedAt: users.updatedAt,
          })
          .from(users)
          .where(eq(users.userId, authRequest.user.userId))
          .limit(1);

        if (!user) {
          return reply.status(404).send({ error: "User not found" });
        }

        const isAdmin = await checkIsAdmin(fastify.drizzle!, user.userId);
        return reply.send({
          user: {
            ...user,
            isAdmin,
          },
        });
      } catch (error: any) {
        if (error instanceof AuthenticationError) {
          return reply.status(error.statusCode).send({
            error: error.message,
            code: error.code,
          });
        }
        fastify.log.error({ err: error }, "Error getting user");
        return reply.status(500).send({
          error: process.env.NODE_ENV === "production" ? "Internal server error" : (error.message || "Internal server error"),
        });
      }
    }
  );
};

export default auth;
