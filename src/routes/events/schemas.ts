import { FastifySchema } from "fastify";

const eventItem = {
  type: "object",
  properties: {
    eventId: { type: "string" },
    title: { type: "string" },
    description: { type: ["string", "null"] },
    detail: { type: ["string", "null"] },
    eventLink: { type: ["string", "null"] },
    type: { type: "string" },
    location: { type: ["string", "null"] },
    startsAt: { type: ["string", "null"], format: "date-time" },
    endsAt: { type: ["string", "null"], format: "date-time" },
    status: { type: "string", enum: ["active", "inactive", "soon"] },
    isActive: { type: "boolean" },
    createdBy: { type: ["string", "null"] },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
};

const eventBody = {
  type: "object",
  required: ["title"],
  properties: {
    title: { type: "string", minLength: 1 },
    description: { type: ["string", "null"] },
    detail: { type: ["string", "null"] },
    eventLink: { type: ["string", "null"] },
    type: { type: "string" },
    location: { type: ["string", "null"] },
    startsAt: { type: ["string", "null"], format: "date-time" },
    endsAt: { type: ["string", "null"], format: "date-time" },
    status: { type: "string", enum: ["active", "inactive", "soon"] },
    isActive: { type: "boolean" },
  },
};

export const listEventsRouteSchema: FastifySchema = {
  response: {
    200: {
      type: "object",
      properties: {
        data: {
          type: "array",
          items: eventItem,
        },
      },
    },
    401: { type: "object", properties: { error: { type: "string" } } },
    500: { type: "object", properties: { error: { type: "string" } } },
  },
};

export const createEventRouteSchema: FastifySchema = {
  body: eventBody,
  response: {
    201: {
      type: "object",
      properties: { data: eventItem },
    },
    401: { type: "object", properties: { error: { type: "string" } } },
    403: { type: "object", properties: { error: { type: "string" } } },
    500: { type: "object", properties: { error: { type: "string" } } },
  },
};

export const updateEventRouteSchema: FastifySchema = {
  params: {
    type: "object",
    required: ["eventId"],
    properties: {
      eventId: { type: "string" },
    },
  },
  body: {
    type: "object",
    properties: eventBody.properties,
  },
  response: {
    200: {
      type: "object",
      properties: { data: eventItem },
    },
    401: { type: "object", properties: { error: { type: "string" } } },
    403: { type: "object", properties: { error: { type: "string" } } },
    404: { type: "object", properties: { error: { type: "string" } } },
    500: { type: "object", properties: { error: { type: "string" } } },
  },
};

export const deleteEventRouteSchema: FastifySchema = {
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
