import { FastifySchema } from "fastify";

const sourceSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    link: { type: "string" },
    snippet: { type: "string" },
    position: { type: "number" },
    date: { type: "string" },
  },
};

const messageSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    conversationId: { type: "string" },
    role: { type: "string" },
    content: { type: "string" },
    sources: {
      type: "array",
      items: sourceSchema,
    },
    createdAt: { type: "string", format: "date-time" },
  },
};

const conversationSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    userId: { type: "string" },
    title: { type: "string" },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
    messages: {
      type: "array",
      items: messageSchema,
    },
  },
};

export const getResearchConversationsRouteSchema: FastifySchema = {
  response: {
    200: {
      type: "object",
      properties: {
        data: {
          type: "array",
          items: conversationSchema,
        },
      },
    },
    500: { type: "object", properties: { error: { type: "string" } } },
  },
};

export const createResearchMessageRouteSchema: FastifySchema = {
  body: {
    type: "object",
    required: ["prompt"],
    properties: {
      conversationId: { type: "string" },
      prompt: { type: "string", minLength: 1 },
    },
  },
  response: {
    200: {
      type: "object",
      properties: {
        data: conversationSchema,
      },
    },
    400: { type: "object", properties: { error: { type: "string" } } },
    404: { type: "object", properties: { error: { type: "string" } } },
    500: { type: "object", properties: { error: { type: "string" } } },
  },
};

export const deleteResearchConversationRouteSchema: FastifySchema = {
  params: {
    type: "object",
    required: ["id"],
    properties: { id: { type: "string" } },
  },
  response: {
    200: {
      type: "object",
      properties: { message: { type: "string" } },
    },
    404: { type: "object", properties: { error: { type: "string" } } },
    500: { type: "object", properties: { error: { type: "string" } } },
  },
};
