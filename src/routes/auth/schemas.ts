import { FastifySchema } from "fastify";

export const registerRouteSchema: FastifySchema = {
  body: {
    type: "object",
    required: ["email", "password", "account"],
    properties: {
      email: { type: "string", format: "email" },
      password: { type: "string", minLength: 8 },
      account: { type: "string" },
      nickname: { type: "string" },
      fullname: { type: "string" },
    },
  },
  response: {
    201: {
      type: "object",
      properties: {
        access_token: { type: "string" },
        user: {
          type: "object",
          properties: {
            userId: { type: "string" },
            email: { type: "string" },
            account: { type: "string" },
            nickname: { type: "string" },
            fullname: { type: "string" },
            isAdmin: { type: "boolean" },
          },
        },
      },
    },
    400: {
      type: "object",
      properties: {
        error: { type: "string" },
      },
    },
    409: {
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

export const loginRouteSchema: FastifySchema = {
  body: {
    type: "object",
    required: ["email", "password"],
    properties: {
      email: { type: "string", format: "email" },
      password: { type: "string" },
    },
  },
  response: {
    200: {
      type: "object",
      properties: {
        access_token: { type: "string" },
        user: {
          type: "object",
          properties: {
            userId: { type: "string" },
            email: { type: "string" },
            account: { type: "string" },
            nickname: { type: "string" },
            fullname: { type: "string" },
            isAdmin: { type: "boolean" },
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

export const meRouteSchema: FastifySchema = {
  response: {
    200: {
      type: "object",
      properties: {
        user: {
          type: "object",
          properties: {
            userId: { type: "string" },
            email: { type: "string" },
            account: { type: "string" },
            nickname: { type: "string" },
            fullname: { type: "string" },
            imageUrl: { type: "string", nullable: true },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
            isAdmin: { type: "boolean" },
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
    404: {
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
