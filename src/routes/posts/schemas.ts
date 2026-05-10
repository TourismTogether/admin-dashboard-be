import { FastifySchema } from "fastify";
import { types } from "util";

const postItem = {
    type: "object",
    properties: {
        postId: { type: "string" },
        authorId: { type: "string" },
        categoryId: { type: "string" },
        title: { type: "string" },
        content: { type: "string" },
        createdAt: { type: ["string", "null"], format: "date-time" },
        updatedAt: { type: ["string", "null"], format: "date-time" }
    },
};


const postBody = {
    type: "object",
    required: ["title"],
    properties: {
        categoryId: { type: "string" },
        title: { type: "string" },
        content: { type: "string" },
    },
};

export const listPostsRouteSchema: FastifySchema = {
    response: {
        200: {
            type: "object",
            properties: {
                data: {
                    type: "array",
                    items: postItem,
                },
            },
        },
        401: { type: "object", properties: { error: { type: "string" } } },
        500: { type: "object", properties: { error: { type: "string" } } },
    },
};

export const createPostRouteSchema: FastifySchema = {
    body: postBody,
    response: {
        201: {
            type: "object",
            properties: { data: postItem },
        },
        401: { type: "object", properties: { error: { type: "string" } } },
        403: { type: "object", properties: { error: { type: "string" } } },
        500: { type: "object", properties: { error: { type: "string" } } },
    },
};

export const updatePostRouteSchema: FastifySchema = {
    params: {
        type: "object",
        required: ["postId"],
        properties: {
            postId: { type: "string" },
        },
    },
    body: {
        type: "object",
        properties: postBody.properties,
    },
    response: {
        200: {
            type: "object",
            properties: { data: postItem },
        },
        401: { type: "object", properties: { error: { type: "string" } } },
        403: { type: "object", properties: { error: { type: "string" } } },
        404: { type: "object", properties: { error: { type: "string" } } },
        500: { type: "object", properties: { error: { type: "string" } } },
    },
};

export const deletePostRouteSchema: FastifySchema = {
    params: {
        type: "object",
        required: ["eventId"],
        properties: {
            eventId: { type: "string" },
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
