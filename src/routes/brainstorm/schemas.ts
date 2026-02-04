import { FastifySchema } from "fastify";

export const getBrainstormsRouteSchema: FastifySchema = {
  response: {
    200: {
      type: "object",
      properties: {
        data: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              userId: { type: "string" },
              name: { type: "string" },
              type: { type: "string" },
              content: { type: "string" },
              createdAt: { type: "string", format: "date-time" },
              updatedAt: { type: "string", format: "date-time" },
            },
          },
        },
      },
    },
    401: {
      type: "object",
      properties: { error: { type: "string" } },
    },
    500: {
      type: "object",
      properties: { error: { type: "string" } },
    },
  },
};

export const getBrainstormRouteSchema: FastifySchema = {
  params: {
    type: "object",
    required: ["id"],
    properties: { id: { type: "string" } },
  },
  response: {
    200: {
      type: "object",
      properties: {
        data: {
          type: "object",
          properties: {
            id: { type: "string" },
            userId: { type: "string" },
            name: { type: "string" },
            type: { type: "string" },
            content: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
      },
    },
    404: { type: "object", properties: { error: { type: "string" } } },
    500: { type: "object", properties: { error: { type: "string" } } },
  },
};

export const createBrainstormRouteSchema: FastifySchema = {
  body: {
    type: "object",
    required: ["type", "content"],
    properties: {
      name: { type: "string" },
      type: { type: "string" },
      content: { type: "string" },
    },
  },
  response: {
    200: {
      type: "object",
      properties: {
        data: {
          type: "object",
          properties: {
            id: { type: "string" },
            userId: { type: "string" },
            name: { type: "string" },
            type: { type: "string" },
            content: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
      },
    },
    500: { type: "object", properties: { error: { type: "string" } } },
  },
};

export const updateBrainstormRouteSchema: FastifySchema = {
  params: {
    type: "object",
    required: ["id"],
    properties: { id: { type: "string" } },
  },
  body: {
    type: "object",
    properties: {
      name: { type: "string" },
      type: { type: "string" },
      content: { type: "string" },
    },
  },
  response: {
    200: {
      type: "object",
      properties: {
        data: {
          type: "object",
          properties: {
            id: { type: "string" },
            userId: { type: "string" },
            name: { type: "string" },
            type: { type: "string" },
            content: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
      },
    },
    404: { type: "object", properties: { error: { type: "string" } } },
    500: { type: "object", properties: { error: { type: "string" } } },
  },
};

export const deleteBrainstormRouteSchema: FastifySchema = {
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
