import bcrypt from "bcrypt";
import { createHash, randomUUID } from "crypto";
import { FastifyPluginAsync } from "fastify";
import { and, eq, isNull } from "drizzle-orm";
import { refreshTokens, users, userAdmin } from "../../db/schema";
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

function hashRefreshToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function getRefreshTokenExpiresAt() {
  const seconds = Number.parseInt(
    process.env.REFRESH_TOKEN_COOKIE_MAX_AGE_SECONDS || "2592000",
    10
  );
  const maxAgeSeconds = Number.isFinite(seconds) ? seconds : 2592000;
  return new Date(Date.now() + maxAgeSeconds * 1000);
}

async function issueTokens(
  drizzleDb: any,
  userId: string,
  email: string,
  previousTokenId?: string
) {
  const refreshTokenId = randomUUID();
  const [accessToken, refreshToken] = await Promise.all([
    generateAccessToken(userId, email),
    generateRefreshToken(userId, email, refreshTokenId),
  ]);

  const insertNewRefreshToken = (db: any) => db.insert(refreshTokens).values({
    tokenId: refreshTokenId,
    userId,
    tokenHash: hashRefreshToken(refreshToken),
    expiresAt: getRefreshTokenExpiresAt(),
  });

  if (previousTokenId) {
    await drizzleDb.transaction(async (tx: any) => {
      const revokedTokens = await tx
        .update(refreshTokens)
        .set({
          revokedAt: new Date(),
          replacedByTokenId: refreshTokenId,
        })
        .where(
          and(
            eq(refreshTokens.tokenId, previousTokenId),
            isNull(refreshTokens.revokedAt)
          )
        )
        .returning({ tokenId: refreshTokens.tokenId });

      if (revokedTokens.length === 0) {
        throw new AuthenticationError(
          401,
          "Refresh token has been reused",
          "JWT",
          "auth_refresh_token_reused"
        );
      }

      await insertNewRefreshToken(tx);
    });
  } else {
    await insertNewRefreshToken(drizzleDb);
  }

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

async function buildUserResponse(drizzleDb: any, userId: string) {
  const [user] = await drizzleDb
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
    .where(eq(users.userId, userId))
    .limit(1);

  if (!user) return null;
  const isAdmin = await checkIsAdmin(drizzleDb, user.userId);
  return { ...user, isAdmin };
}

async function revokeRefreshToken(drizzleDb: any, token: string) {
  const tokenUser = await verifyRefreshToken(token);
  if (!tokenUser.tokenId) return;

  await drizzleDb
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(eq(refreshTokens.tokenId, tokenUser.tokenId));
}

async function assertRefreshTokenIsActive(
  drizzleDb: any,
  token: string,
  userId: string,
  tokenId: string
) {
  const [storedToken] = await drizzleDb
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenId, tokenId))
    .limit(1);

  if (
    !storedToken ||
    storedToken.userId !== userId ||
    storedToken.tokenHash !== hashRefreshToken(token) ||
    storedToken.expiresAt < new Date()
  ) {
    throw new AuthenticationError(
      401,
      "Invalid refresh token",
      "JWT",
      "auth_refresh_token_invalid"
    );
  }

  if (storedToken.revokedAt) {
    await drizzleDb
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));

    throw new AuthenticationError(
      401,
      "Refresh token has been reused",
      "JWT",
      "auth_refresh_token_reused"
    );
  }
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
          fastify.drizzle!,
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
          fastify.drizzle!,
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
        await assertRefreshTokenIsActive(
          fastify.drizzle!,
          refreshToken,
          tokenUser.userId,
          tokenUser.tokenId!
        );
        const user = await buildUserResponse(fastify.drizzle!, tokenUser.userId);

        if (!user) {
          return reply
            .header("Set-Cookie", getClearedRefreshCookie())
            .status(401)
            .send({
              error: "User not found",
              code: "auth_user_not_found",
            });
        }

        const tokens = await issueTokens(
          fastify.drizzle!,
          user.userId,
          user.email,
          tokenUser.tokenId
        );
        return reply
          .header("Set-Cookie", getRefreshCookie(tokens.refreshToken))
          .send({ access_token: tokens.accessToken, user });
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
    async (request, reply) => {
      const refreshToken = getCookie(request, REFRESH_TOKEN_COOKIE);
      if (refreshToken && fastify.drizzle) {
        try {
          await revokeRefreshToken(fastify.drizzle, refreshToken);
        } catch (error) {
          fastify.log.warn({ err: error }, "Unable to revoke refresh token on logout");
        }
      }

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

        const user = await buildUserResponse(fastify.drizzle!, authRequest.user.userId);

        if (!user) {
          return reply.status(404).send({ error: "User not found" });
        }

        return reply.send({
          user,
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
