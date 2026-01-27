import { FastifySchema } from "fastify";

export const getPersonalTaskEmailSettingsSchema: FastifySchema = {
  response: {
    200: {
      type: "object",
      properties: {
        data: {
          type: "object",
          properties: {
            sendPersonalTasksEmail: { type: "boolean" },
            email: { type: "string", format: "email", nullable: true },
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

export const updatePersonalTaskEmailSettingsSchema: FastifySchema = {
  body: {
    type: "object",
    required: ["sendPersonalTasksEmail", "email"],
    properties: {
      sendPersonalTasksEmail: { type: "boolean" },
      email: { type: "string", format: "email" },
    },
  },
  response: {
    200: {
      type: "object",
      properties: {
        data: {
          type: "object",
          properties: {
            sendPersonalTasksEmail: { type: "boolean" },
            email: { type: "string", format: "email", nullable: true },
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

