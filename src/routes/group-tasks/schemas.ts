import { FastifySchema } from "fastify";

export const getGroupTasksRouteSchema: FastifySchema = {
  querystring: {
    type: "object",
    properties: {
      groupId: { type: "string" },
      status: { type: "string", enum: ["todo", "in_progress", "reopen", "done", "delay"] },
      priority: { type: "string", enum: ["low", "medium", "high"] },
    },
  },
  response: {
    200: {
      type: "object",
      properties: {
        data: {
          type: "array",
          items: {
            type: "object",
            properties: {
              groupTaskId: { type: "string" },
              groupId: { type: "string" },
              priority: { type: "string" },
              status: { type: "string" },
              startDate: { type: "string", format: "date", nullable: true },
              endDate: { type: "string", format: "date", nullable: true },
              requirement: { type: "string", nullable: true },
              delivery: { type: "string", nullable: true },
              note: { type: "string", nullable: true },
              createdAt: { type: "string", format: "date-time" },
              updatedAt: { type: "string", format: "date-time" },
            },
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

export const getGroupTaskRouteSchema: FastifySchema = {
  params: {
    type: "object",
    required: ["groupTaskId"],
    properties: {
      groupTaskId: { type: "string" },
    },
  },
  response: {
    200: {
      type: "object",
      properties: {
        data: {
          type: "object",
          properties: {
            groupTaskId: { type: "string" },
            groupId: { type: "string" },
            priority: { type: "string" },
            status: { type: "string" },
            startDate: { type: "string", format: "date", nullable: true },
            endDate: { type: "string", format: "date", nullable: true },
            requirement: { type: "string", nullable: true },
            delivery: { type: "string", nullable: true },
            note: { type: "string", nullable: true },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
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

export const createGroupTaskRouteSchema: FastifySchema = {
  body: {
    type: "object",
    required: ["groupId"],
    properties: {
      groupId: { type: "string" },
      priority: { type: "string", enum: ["low", "medium", "high"] },
      status: { type: "string", enum: ["todo", "in_progress", "reopen", "done", "delay"] },
      startDate: { type: "string", format: "date" },
      endDate: { type: "string", format: "date" },
      requirement: { type: "string" },
      delivery: { type: "string" },
      note: { type: "string" },
    },
  },
  response: {
    201: {
      type: "object",
      properties: {
        data: {
          type: "object",
          properties: {
            groupTaskId: { type: "string" },
            groupId: { type: "string" },
            priority: { type: "string" },
            status: { type: "string" },
            startDate: { type: "string", format: "date", nullable: true },
            endDate: { type: "string", format: "date", nullable: true },
            requirement: { type: "string", nullable: true },
            delivery: { type: "string", nullable: true },
            note: { type: "string", nullable: true },
          },
        },
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

export const updateGroupTaskRouteSchema: FastifySchema = {
  params: {
    type: "object",
    required: ["groupTaskId"],
    properties: {
      groupTaskId: { type: "string" },
    },
  },
  body: {
    type: "object",
    properties: {
      priority: { type: "string", enum: ["low", "medium", "high"] },
      status: { type: "string", enum: ["todo", "in_progress", "reopen", "done", "delay"] },
      startDate: { type: "string", format: "date" },
      endDate: { type: "string", format: "date" },
      requirement: { type: "string" },
      delivery: { type: "string" },
      note: { type: "string" },
    },
  },
  response: {
    200: {
      type: "object",
      properties: {
        data: {
          type: "object",
          properties: {
            groupTaskId: { type: "string" },
            groupId: { type: "string" },
            priority: { type: "string" },
            status: { type: "string" },
            startDate: { type: "string", format: "date", nullable: true },
            endDate: { type: "string", format: "date", nullable: true },
            requirement: { type: "string", nullable: true },
            delivery: { type: "string", nullable: true },
            note: { type: "string", nullable: true },
          },
        },
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

export const deleteGroupTaskRouteSchema: FastifySchema = {
  params: {
    type: "object",
    required: ["groupTaskId"],
    properties: {
      groupTaskId: { type: "string" },
    },
  },
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
    500: {
      type: "object",
      properties: {
        error: { type: "string" },
      },
    },
  },
};
