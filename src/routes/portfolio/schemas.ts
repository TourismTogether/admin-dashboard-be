import { FastifySchema } from "fastify";

// Get portfolio schema
export const getPortfolioRouteSchema: FastifySchema = {
  response: {
    200: {
      type: "object",
      properties: {
        data: {
          oneOf: [
            {
              type: "object",
              properties: {
                portfolioId: { type: "string", format: "uuid" },
                userId: { type: "string", format: "uuid" },
                username: { type: "string", nullable: true },
                bio: { type: "string", nullable: true },
                avatarUrl: { type: "string", nullable: true },
                readme: { type: "string", nullable: true },
                location: { type: "string", nullable: true },
                company: { type: "string", nullable: true },
                blog: { type: "string", nullable: true },
                twitterUsername: { type: "string", nullable: true },
                commits: { type: "number", default: 0 },
                createdAt: { type: "string", format: "date-time" },
                updatedAt: { type: "string", format: "date-time" },
              },
            },
            { type: "null" },
          ],
        },
      },
    },
    401: {
      type: "object",
      properties: {
        error: { type: "string" },
      },
    },
    500: {
      type: "object",
      properties: {
        error: { type: "string" },
      },
    },
  },
};

// Create/Update portfolio schema
export const upsertPortfolioRouteSchema: FastifySchema = {
  body: {
    type: "object",
    properties: {
      username: { type: "string" },
      bio: { type: "string" },
      avatarUrl: { type: "string" },
      readme: { type: "string" },
      location: { type: "string" },
      company: { type: "string" },
      blog: { type: "string" },
      twitterUsername: { type: "string" },
    },
  },
  response: {
    200: {
      type: "object",
      properties: {
        data: {
          type: "object",
          properties: {
            portfolioId: { type: "string", format: "uuid" },
            userId: { type: "string", format: "uuid" },
            username: { type: "string", nullable: true },
            bio: { type: "string", nullable: true },
            avatarUrl: { type: "string", nullable: true },
            readme: { type: "string", nullable: true },
            location: { type: "string", nullable: true },
            company: { type: "string", nullable: true },
            blog: { type: "string", nullable: true },
            twitterUsername: { type: "string", nullable: true },
            commits: { type: "number", default: 0 },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
      },
    },
    401: {
      type: "object",
      properties: {
        error: { type: "string" },
      },
    },
    500: {
      type: "object",
      properties: {
        error: { type: "string" },
      },
    },
  },
};

// Delete portfolio schema
export const deletePortfolioRouteSchema: FastifySchema = {
  response: {
    200: {
      type: "object",
      properties: {
        message: { type: "string" },
      },
    },
    404: {
      type: "object",
      properties: {
        error: { type: "string" },
      },
    },
    401: {
      type: "object",
      properties: {
        error: { type: "string" },
      },
    },
    500: {
      type: "object",
      properties: {
        error: { type: "string" },
      },
    },
  },
};

// Leaderboard schema
export const getLeaderboardRouteSchema: FastifySchema = {
  response: {
    200: {
      type: "object",
      properties: {
        data: {
          type: "array",
          items: {
            type: "object",
            properties: {
              userId: { type: "string", format: "uuid" },
              displayName: { type: "string" },
              email: { type: "string" },
              avatarUrl: { type: ["string", "null"] },
              commits: { type: "number" },
              commitsLast30Days: { type: "number" },
              highPriorityCommits: { type: "number" },
              streakDays: { type: "number" },
              score: { type: "number" },
              rank: { type: "number" },
            },
            required: [
              "userId",
              "displayName",
              "email",
              "avatarUrl",
              "commits",
              "commitsLast30Days",
              "highPriorityCommits",
              "streakDays",
              "score",
              "rank",
            ],
          },
        },
      },
      required: ["data"],
    },
    401: {
      type: "object",
      properties: {
        error: { type: "string" },
      },
    },
    500: {
      type: "object",
      properties: {
        error: { type: "string" },
      },
    },
  },
};
