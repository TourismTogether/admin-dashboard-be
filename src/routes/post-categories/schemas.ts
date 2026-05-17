import { FastifySchema } from "fastify";

const postCategoryItem = {
  type: "object",
  properties: {
    categoryId: { type: "string" },
    name: { type: "string" },
    createdAt: { type: ["string", "null"], format: "date-time" },
    updatedAt: { type: ["string", "null"], format: "date-time" }
  },
};

const postCategoryBody = {
  type: "object",
  required: ["name"],
  properties: {
    name: { type: "string" }
  },
};

export const listPostCategoriesRouteSchema: FastifySchema = {
  response: {
    200: {
      type: "object",
      properties: {
        data: {
          type: "array",
          items: postCategoryItem,
        },
      },
    },
    401: { type: "object", properties: { error: { type: "string" } } },
    500: { type: "object", properties: { error: { type: "string" } } },
  },
};

export const createPostCategoryRouteSchema: FastifySchema = {
  body: postCategoryBody,
  response: {
    201: {
      type: "object",
      properties: { data: postCategoryItem },
    },
    401: { type: "object", properties: { error: { type: "string" } } },
    403: { type: "object", properties: { error: { type: "string" } } },
    500: { type: "object", properties: { error: { type: "string" } } },
  },
};

export const updatePostCategoryRouteSchema: FastifySchema = {
  params: {
    type: "object",
    required: ["categoryId"],
    properties: {
      categoryId: { type: "string" },
    },
  },
  body: postCategoryBody,
  response: {
    200: {
      type: "object",
      properties: { data: postCategoryItem },
    },
    401: { type: "object", properties: { error: { type: "string" } } },
    403: { type: "object", properties: { error: { type: "string" } } },
    404: { type: "object", properties: { error: { type: "string" } } },
    500: { type: "object", properties: { error: { type: "string" } } },
  },
};

export const deletePostCategoryRouteSchema: FastifySchema = {
  params: {
    type: "object",
    required: ["categoryId"],
    properties: {
      categoryId: { type: "string" },
    },
  },
  response: {
    200: { type: "object", properties: { message: { type: "string" } } },
    401: { type: "object", properties: { error: { type: "string" } } },
    403: { type: "object", properties: { error: { type: "string" } } },
    404: { type: "object", properties: { error: { type: "string" } } },
    500: { type: "object", properties: { error: { type: "string" } } },
  },
};