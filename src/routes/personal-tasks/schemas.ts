import { FastifySchema } from "fastify";

export const getTablesRouteSchema: FastifySchema = {
  response: {
    200: {
      type: "object",
      properties: {
        data: {
          type: "array",
          items: {
            type: "object",
            properties: {
              tableId: { type: "string" },
              userId: { type: "string" },
              week: { type: "number" },
              startDate: { type: "string", format: "date" },
              description: { type: "string", nullable: true },
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

export const getTableRouteSchema: FastifySchema = {
  params: {
    type: "object",
    required: ["tableId"],
    properties: {
      tableId: { type: "string" },
    },
  },
  response: {
    200: {
      type: "object",
      properties: {
        data: {
          type: "object",
          properties: {
            tableId: { type: "string" },
            userId: { type: "string" },
            week: { type: "number" },
            startDate: { type: "string", format: "date" },
            description: { type: "string", nullable: true },
            swimlanes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  swimlaneId: { type: "string" },
                  tableId: { type: "string" },
                  content: { type: "string" },
                  startTime: { type: "string", nullable: true },
                  duration: { type: "number", nullable: true },
                  tasks: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        taskId: { type: "string" },
                        swimlaneId: { type: "string" },
                        content: { type: "string" },
                        status: { type: "string" },
                        priority: { type: "string" },
                        detail: { type: "string", nullable: true },
                        createdAt: { type: "string", format: "date-time" },
                        updatedAt: { type: "string", format: "date-time" },
                      },
                    },
                  },
                },
              },
            },
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

export const createTableRouteSchema: FastifySchema = {
  body: {
    type: "object",
    required: ["startDate", "week"],
    properties: {
      startDate: { type: "string", format: "date" },
      week: { type: "number" },
      description: { type: "string" },
    },
  },
  response: {
    200: {
      type: "object",
      properties: {
        data: {
          type: "object",
          properties: {
            tableId: { type: "string" },
            userId: { type: "string" },
            week: { type: "number" },
            startDate: { type: "string", format: "date" },
            description: { type: "string", nullable: true },
          },
        },
        swimlanes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              swimlaneId: { type: "string" },
              tableId: { type: "string" },
              content: { type: "string" },
              startTime: { type: "string", nullable: true },
              duration: { type: "number", nullable: true },
            },
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

export const updateTableRouteSchema: FastifySchema = {
  params: {
    type: "object",
    required: ["tableId"],
    properties: {
      tableId: { type: "string" },
    },
  },
  body: {
    type: "object",
    properties: {
      startDate: { type: "string", format: "date" },
      week: { type: "number" },
      description: { type: "string" },
    },
  },
  response: {
    200: {
      type: "object",
      properties: {
        data: {
          type: "object",
          properties: {
            tableId: { type: "string" },
            userId: { type: "string" },
            week: { type: "number" },
            startDate: { type: "string", format: "date" },
            description: { type: "string", nullable: true },
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

export const deleteTableRouteSchema: FastifySchema = {
  params: {
    type: "object",
    required: ["tableId"],
    properties: {
      tableId: { type: "string" },
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

export const createSwimlaneRouteSchema: FastifySchema = {
  body: {
    type: "object",
    required: ["tableId", "content"],
    properties: {
      tableId: { type: "string" },
      content: { type: "string" },
      startTime: { type: "string" },
      duration: { type: "number" },
    },
  },
  response: {
    200: {
      type: "object",
      properties: {
        data: {
          type: "object",
          properties: {
            swimlaneId: { type: "string" },
            tableId: { type: "string" },
            content: { type: "string" },
            startTime: { type: "string", nullable: true },
            duration: { type: "number", nullable: true },
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

export const updateSwimlaneRouteSchema: FastifySchema = {
  params: {
    type: "object",
    required: ["swimlaneId"],
    properties: {
      swimlaneId: { type: "string" },
    },
  },
  body: {
    type: "object",
    properties: {
      content: { type: "string" },
      startTime: { type: "string" },
      duration: { type: "number" },
    },
  },
  response: {
    200: {
      type: "object",
      properties: {
        data: {
          type: "object",
          properties: {
            swimlaneId: { type: "string" },
            tableId: { type: "string" },
            content: { type: "string" },
            startTime: { type: "string", nullable: true },
            duration: { type: "number", nullable: true },
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

export const deleteSwimlaneRouteSchema: FastifySchema = {
  params: {
    type: "object",
    required: ["swimlaneId"],
    properties: {
      swimlaneId: { type: "string" },
    },
  },
  response: {
    200: {
      type: "object",
      properties: {
        message: { type: "string" },
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

export const createTaskRouteSchema: FastifySchema = {
  body: {
    type: "object",
    required: ["swimlaneId", "content", "taskDate"],
    properties: {
      swimlaneId: { type: "string" },
      content: { type: "string" },
      status: { type: "string", enum: ["todo", "in_progress", "reopen", "done", "delay"] },
      priority: { type: "string", enum: ["low", "medium", "high"] },
      detail: { type: "string" },
      taskDate: { type: "string", format: "date" },
    },
  },
  response: {
    200: {
      type: "object",
      properties: {
        data: {
          type: "object",
          properties: {
            taskId: { type: "string" },
            swimlaneId: { type: "string" },
            content: { type: "string" },
            status: { type: "string" },
            priority: { type: "string" },
            detail: { type: "string", nullable: true },
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

export const updateTaskRouteSchema: FastifySchema = {
  params: {
    type: "object",
    required: ["taskId"],
    properties: {
      taskId: { type: "string" },
    },
  },
  body: {
    type: "object",
    properties: {
      content: { type: "string" },
      status: { type: "string", enum: ["todo", "in_progress", "reopen", "done", "delay"] },
      priority: { type: "string", enum: ["low", "medium", "high"] },
      detail: { type: "string" },
    },
  },
  response: {
    200: {
      type: "object",
      properties: {
        data: {
          type: "object",
          properties: {
            taskId: { type: "string" },
            swimlaneId: { type: "string" },
            content: { type: "string" },
            status: { type: "string" },
            priority: { type: "string" },
            detail: { type: "string", nullable: true },
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

export const deleteTaskRouteSchema: FastifySchema = {
  params: {
    type: "object",
    required: ["taskId"],
    properties: {
      taskId: { type: "string" },
    },
  },
  response: {
    200: {
      type: "object",
      properties: {
        message: { type: "string" },
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
