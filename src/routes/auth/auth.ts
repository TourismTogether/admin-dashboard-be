import { createSecretKey, KeyObject } from "crypto";
import { FastifyError, FastifyReply, FastifyRequest, RouteGenericInterface } from "fastify";
import { jwtVerify, SignJWT, errors, type JWTPayload } from "jose";
import { eq } from "drizzle-orm";
import { users } from "../../db/schema";

export const accessTokenSecret: KeyObject = createSecretKey(
  Buffer.from(process.env.ACCESS_TOKEN_SECRET || "your-secret-key-change-in-production", "utf-8")
);

if (!process.env.ACCESS_TOKEN_SECRET) {
  console.warn("⚠️  ACCESS_TOKEN_SECRET is not set. Using default secret (NOT SECURE FOR PRODUCTION)");
}

export interface JwtPayload extends JWTPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
  [key: string]: unknown; // Index signature to match JWTPayload requirements
}

export interface User {
  userId: string;
  email: string;
}

export interface AuthenticatedRequest<
  RouteGeneric extends RouteGenericInterface = RouteGenericInterface
> extends FastifyRequest<RouteGeneric> {
  user?: User;
}

export class AuthenticationError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public authMethod: string,
    public code: string
  ) {
    super(message);
    this.name = "AuthenticationError";
  }
}

export async function verifyAccessToken(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authorizationHeader = request.headers.authorization;
  const accessToken = authorizationHeader?.split(" ")[1];

  if (!accessToken) {
    throw new AuthenticationError(
      401,
      "No token provided",
      "JWT",
      "auth_no_token"
    );
  }

  try {
    const { payload } = await jwtVerify<JwtPayload>(
      accessToken,
      accessTokenSecret
    );

    const userId = payload.userId;
    const email = payload.email;

    if (!userId || !email) {
      throw new AuthenticationError(
        401,
        "Invalid token payload",
        "JWT",
        "auth_invalid_payload"
      );
    }

    // Verify user exists in database
    if (!(request.server as any).drizzle) {
      throw new AuthenticationError(
        500,
        "Database not available",
        "JWT",
        "auth_db_error"
      );
    }

    const db = (request.server as any).drizzle;
    const [user] = await db
      .select({
        userId: users.userId,
        email: users.email,
      })
      .from(users)
      .where(eq(users.userId, userId))
      .limit(1);

    if (!user) {
      throw new AuthenticationError(
        401,
        "User not found",
        "JWT",
        "auth_user_not_found"
      );
    }

    (request as AuthenticatedRequest).user = {
      userId: user.userId,
      email: user.email,
    };
  } catch (err) {
    if (err instanceof errors.JWTExpired) {
      throw new AuthenticationError(
        401,
        "Token expired",
        "JWT",
        "auth_token_expired"
      );
    } else if (err instanceof errors.JWTInvalid || err instanceof errors.JWSInvalid) {
      throw new AuthenticationError(
        401,
        "Invalid token",
        "JWT",
        "auth_token_invalid"
      );
    } else if (err instanceof AuthenticationError) {
      throw err;
    } else {
      throw new AuthenticationError(
        401,
        "Unauthorized",
        "JWT",
        "auth_unauthorized"
      );
    }
  }
}

export async function generateAccessToken(
  userId: string,
  email: string
): Promise<string> {
  const expirationTime = process.env.ACCESS_TOKEN_EXPIRATION || "7d";
  
  const payload: JwtPayload = {
    userId,
    email,
  };
  
  return await new SignJWT(payload as JWTPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expirationTime)
    .sign(accessTokenSecret);
}
