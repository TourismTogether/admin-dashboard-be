import { FastifySchema } from "fastify";

export const getTakeNotesRouteSchema: FastifySchema = {
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
              title: { type: "string" },
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

export const getTakeNoteRouteSchema: FastifySchema = {
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
            title: { type: "string" },
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

export const createTakeNoteRouteSchema: FastifySchema = {
  body: {
    type: "object",
    properties: {
      title: { type: "string" },
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
            title: { type: "string" },
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

export const updateTakeNoteRouteSchema: FastifySchema = {
  params: {
    type: "object",
    required: ["id"],
    properties: { id: { type: "string" } },
  },
  body: {
    type: "object",
    properties: {
      title: { type: "string" },
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
            title: { type: "string" },
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

export const deleteTakeNoteRouteSchema: FastifySchema = {
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
