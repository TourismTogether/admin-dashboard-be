import { FastifySchema } from "fastify";

const roleEnum = ["owner", "admin", "leader", "member"] as const;

export const getGroupsRouteSchema: FastifySchema = {
  response: {
    200: {
      type: "object",
      properties: {
        data: {
          type: "array",
          items: {
            type: "object",
            properties: {
              groupId: { type: "string", format: "uuid" },
              name: { type: "string" },
              description: { type: ["string", "null"] },
              imageUrl: { type: ["string", "null"] },
              role: { type: "string", enum: roleEnum as unknown as string[] },
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

export const createGroupRouteSchema: FastifySchema = {

  body: {
    type: "object",
    required: ["name"],
    properties: {
      name: { type: "string", minLength: 1, maxLength: 255 },
      description: { type: "string" },
      imageUrl: { type: "string" },
    },
  },
  response: {
    201: {
      type: "object",
      properties: {
        data: {
          type: "object",
          properties: {
            groupId: { type: "string", format: "uuid" },
            name: { type: "string" },
            description: { type: ["string", "null"] },
            imageUrl: { type: ["string", "null"] },
            role: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
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

export const addGroupMemberRouteSchema: FastifySchema = {
  params: {
    type: "object",
    required: ["groupId"],
    properties: {
      groupId: { type: "string", format: "uuid" },
    },
  },
  body: {
    type: "object",
    required: ["email"],
    properties: {
      email: { type: "string", format: "email" },
      role: { type: "string", enum: roleEnum as unknown as string[] },
    },
  },
  response: {
    201: {
      type: "object",
      properties: {
        data: {
          type: "object",
          properties: {
            groupId: { type: "string", format: "uuid" },
            userId: { type: "string", format: "uuid" },
            email: { type: "string", format: "email" },
            role: { type: "string", enum: roleEnum as unknown as string[] },
          },
        },
      },
    },
    400: {
      type: "object",
      properties: { error: { type: "string" } },
    },
    401: {
      type: "object",
      properties: { error: { type: "string" } },
    },
    403: {
      type: "object",
      properties: { error: { type: "string" } },
    },
    404: {
      type: "object",
      properties: { error: { type: "string" } },
    },
    500: {
      type: "object",
      properties: { error: { type: "string" } },
    },
  },
};

export const getGroupMembersRouteSchema: FastifySchema = {
  params: {
    type: "object",
    required: ["groupId"],
    properties: {
      groupId: { type: "string", format: "uuid" },
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
              userId: { type: "string", format: "uuid" },
              email: { type: "string", format: "email" },
              nickname: { type: ["string", "null"] },
              fullname: { type: ["string", "null"] },
              role: { type: "string", enum: roleEnum as unknown as string[] },
            },
          },
        },
      },
    },
    401: { type: "object", properties: { error: { type: "string" } } },
    403: { type: "object", properties: { error: { type: "string" } } },
    404: { type: "object", properties: { error: { type: "string" } } },
    500: { type: "object", properties: { error: { type: "string" } } },
  },
};

export const deleteGroupRouteSchema: FastifySchema = {
  params: {
    type: "object",
    required: ["groupId"],
    properties: {
      groupId: { type: "string", format: "uuid" },
    },
  },
  response: {
    200: {
      type: "object",
      properties: {
        message: { type: "string" },
      },
    },
    401: {
      type: "object",
      properties: { error: { type: "string" } },
    },
    403: {
      type: "object",
      properties: { error: { type: "string" } },
    },
    500: {
      type: "object",
      properties: { error: { type: "string" } },
    },
  },
};

export const updateGroupRouteSchema: FastifySchema = {
  params: {
    type: "object",
    required: ["groupId"],
    properties: {
      groupId: { type: "string", format: "uuid" },
    },
  },
  body: {
    type: "object",
    properties: {
      name: { type: "string", minLength: 1, maxLength: 255 },
      description: { type: ["string", "null"] },
    },
  },
  response: {
    200: {
      type: "object",
      properties: {
        data: {
          type: "object",
          properties: {
            groupId: { type: "string", format: "uuid" },
            name: { type: "string" },
            description: { type: ["string", "null"] },
            imageUrl: { type: ["string", "null"] },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
      },
    },
    400: { type: "object", properties: { error: { type: "string" } } },
    401: { type: "object", properties: { error: { type: "string" } } },
    403: { type: "object", properties: { error: { type: "string" } } },
    404: { type: "object", properties: { error: { type: "string" } } },
    500: { type: "object", properties: { error: { type: "string" } } },
  },
};
