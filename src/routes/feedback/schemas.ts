import { FastifySchema } from "fastify";

export const listFeedbackRouteSchema: FastifySchema = {
  response: {
    200: {
      type: "object",
      properties: {
        data: {
          type: "array",
          items: {
            type: "object",
            properties: {
              feedbackId: { type: "string" },
              name: { type: "string" },
              reason: { type: "string" },
              adminResponse: { type: ["string", "null"] },
              createdAt: { type: "string" },
              updatedAt: { type: "string" },
            },
          },
        },
      },
    },
  },
};

export const createFeedbackRouteSchema: FastifySchema = {
  body: {
    type: "object",
    required: ["name", "reason"],
    properties: {
      name: { type: "string", minLength: 1, maxLength: 500 },
      reason: { type: "string", minLength: 1 },
    },
  },
  response: {
    201: {
      type: "object",
      properties: {
        data: {
          type: "object",
          properties: {
            feedbackId: { type: "string" },
            name: { type: "string" },
            reason: { type: "string" },
            adminResponse: { type: ["string", "null"] },
            createdAt: { type: "string" },
            updatedAt: { type: "string" },
          },
        },
      },
    },
    400: { type: "object", properties: { error: { type: "string" } } },
  },
};

export const updateFeedbackRouteSchema: FastifySchema = {
  params: {
    type: "object",
    required: ["feedbackId"],
    properties: { feedbackId: { type: "string" } },
  },
  body: {
    type: "object",
    required: ["name", "reason"],
    properties: {
      name: { type: "string", minLength: 1, maxLength: 500 },
      reason: { type: "string", minLength: 1 },
    },
  },
  response: {
    200: { type: "object", properties: { data: { type: "object" } } },
    403: { type: "object", properties: { error: { type: "string" } } },
    404: { type: "object", properties: { error: { type: "string" } } },
  },
};

export const deleteFeedbackRouteSchema: FastifySchema = {
  params: {
    type: "object",
    required: ["feedbackId"],
    properties: { feedbackId: { type: "string" } },
  },
  response: {
    200: { type: "object", properties: { message: { type: "string" } } },
    403: { type: "object", properties: { error: { type: "string" } } },
    404: { type: "object", properties: { error: { type: "string" } } },
  },
};

export const adminListFeedbackRouteSchema: FastifySchema = {
  response: {
    200: {
      type: "object",
      properties: {
        data: {
          type: "array",
          items: {
            type: "object",
            properties: {
              feedbackId: { type: "string" },
              name: { type: "string" },
              reason: { type: "string" },
              userId: { type: "string" },
              userEmail: { type: "string" },
              adminResponse: { type: ["string", "null"] },
              adminUserId: { type: ["string", "null"] },
              createdAt: { type: "string" },
              updatedAt: { type: "string" },
            },
          },
        },
      },
    },
  },
};

export const adminRespondFeedbackRouteSchema: FastifySchema = {
  params: {
    type: "object",
    required: ["feedbackId"],
    properties: { feedbackId: { type: "string" } },
  },
  body: {
    type: "object",
    required: ["adminResponse"],
    properties: { adminResponse: { type: "string" } },
  },
  response: {
    200: { type: "object", properties: { data: { type: "object" } } },
    404: { type: "object", properties: { error: { type: "string" } } },
  },
};
