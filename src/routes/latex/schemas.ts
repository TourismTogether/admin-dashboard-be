import { FastifySchema } from "fastify";

const latexDocumentProperties = {
  id: { type: "string" },
  userId: { type: "string" },
  title: { type: "string" },
  content: { type: "string" },
  createdAt: { type: "string", format: "date-time" },
  updatedAt: { type: "string", format: "date-time" },
};

export const getLatexDocumentsRouteSchema: FastifySchema = {
  response: {
    200: {
      type: "object",
      properties: {
        data: {
          type: "array",
          items: { type: "object", properties: latexDocumentProperties },
        },
      },
    },
    401: { type: "object", properties: { error: { type: "string" } } },
    500: { type: "object", properties: { error: { type: "string" } } },
  },
};

export const getLatexDocumentRouteSchema: FastifySchema = {
  params: {
    type: "object",
    required: ["id"],
    properties: { id: { type: "string" } },
  },
  response: {
    200: {
      type: "object",
      properties: {
        data: { type: "object", properties: latexDocumentProperties },
      },
    },
    404: { type: "object", properties: { error: { type: "string" } } },
    500: { type: "object", properties: { error: { type: "string" } } },
  },
};

export const createLatexDocumentRouteSchema: FastifySchema = {
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
        data: { type: "object", properties: latexDocumentProperties },
      },
    },
    500: { type: "object", properties: { error: { type: "string" } } },
  },
};

export const updateLatexDocumentRouteSchema: FastifySchema = {
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
        data: { type: "object", properties: latexDocumentProperties },
      },
    },
    404: { type: "object", properties: { error: { type: "string" } } },
    500: { type: "object", properties: { error: { type: "string" } } },
  },
};

export const deleteLatexDocumentRouteSchema: FastifySchema = {
  params: {
    type: "object",
    required: ["id"],
    properties: { id: { type: "string" } },
  },
  response: {
    200: { type: "object", properties: { message: { type: "string" } } },
    404: { type: "object", properties: { error: { type: "string" } } },
    500: { type: "object", properties: { error: { type: "string" } } },
  },
};

export const compileLatexRouteSchema: FastifySchema = {
  body: {
    type: "object",
    required: ["content"],
    properties: {
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
            pdfBase64: { type: "string" },
            log: { type: "string" },
            engine: { type: "string" },
          },
        },
      },
    },
    400: {
      type: "object",
      properties: {
        error: { type: "string" },
        log: { type: "string" },
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
