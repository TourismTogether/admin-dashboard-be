import bcrypt from "bcrypt";
import { FastifyPluginAsync } from "fastify";
import { eq } from "drizzle-orm";
import { users } from "../../db/schema";
import {
  generateAccessToken,
  verifyAccessToken,
  AuthenticationError,
  AuthenticatedRequest,
} from "./auth";
import {
  registerRouteSchema,
  loginRouteSchema,
  meRouteSchema,
} from "./schemas";

const saltRounds = 10;
const MIN_PASSWORD_LENGTH = 8;

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

        // Generate access token
        const accessToken = await generateAccessToken(newUser.userId, newUser.email);

        return reply.status(201).send({
          access_token: accessToken,
          user: {
            userId: newUser.userId,
            email: newUser.email,
            account: newUser.account,
            nickname: newUser.nickname,
            fullname: newUser.fullname,
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

        // Generate access token
        const accessToken = await generateAccessToken(user.userId, user.email);

        return reply.send({
          access_token: accessToken,
          user: {
            userId: user.userId,
            email: user.email,
            account: user.account,
            nickname: user.nickname,
            fullname: user.fullname,
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

        return reply.send({ user });
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
