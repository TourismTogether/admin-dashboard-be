export const getGroupSwimlanesRouteSchema = {
  tags: ["Group Swimlanes"],
  description: "Get all swimlanes for a group task",
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
          type: "array",
          items: {
            type: "object",
            properties: {
              swimlaneId: { type: "string" },
              groupTaskId: { type: "string" },
              assignedUserId: { type: "string" },
              content: { type: "string" },
              createdAt: { type: "string" },
              updatedAt: { type: "string" },
            },
          },
        },
      },
    },
    400: { type: "object" },
    401: { type: "object" },
    403: { type: "object" },
    404: { type: "object" },
    500: { type: "object" },
  },
};

export const createSwimlanesRouteSchema = {
  tags: ["Group Swimlanes"],
  description: "Create a new swimlane in a group task",
  body: {
    type: "object",
    required: ["groupTaskId", "content"],
    properties: {
      groupTaskId: { type: "string" },
      content: { type: "string" },
      assignedUserId: { type: "string" },
    },
  },
  response: {
    201: {
      type: "object",
      properties: {
        data: {
          type: "object",
          properties: {
            swimlaneId: { type: "string" },
            groupTaskId: { type: "string" },
            assignedUserId: { type: "string" },
            content: { type: "string" },
            createdAt: { type: "string" },
            updatedAt: { type: "string" },
          },
        },
      },
    },
    400: { type: "object" },
    401: { type: "object" },
    403: { type: "object" },
    404: { type: "object" },
    500: { type: "object" },
  },
};

export const updateSwimlaneRouteSchema = {
  tags: ["Group Swimlanes"],
  description: "Update a swimlane",
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
      assignedUserId: { type: "string" },
    },
  },
  response: {
    200: {
      type: "object",
      properties: {
        data: {
          type: "object",
        },
      },
    },
    400: { type: "object" },
    401: { type: "object" },
    403: { type: "object" },
    404: { type: "object" },
    500: { type: "object" },
  },
};

export const deleteSwimlaneRouteSchema = {
  tags: ["Group Swimlanes"],
  description: "Delete a swimlane",
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
    400: { type: "object" },
    401: { type: "object" },
    403: { type: "object" },
    404: { type: "object" },
    500: { type: "object" },
  },
};

export const getGroupTaskDetailsRouteSchema = {
  tags: ["Group Task Details"],
  description: "Get all tasks in a swimlane",
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
        data: {
          type: "array",
          items: {
            type: "object",
          },
        },
      },
    },
    400: { type: "object" },
    401: { type: "object" },
    403: { type: "object" },
    404: { type: "object" },
    500: { type: "object" },
  },
};

export const createGroupTaskDetailRouteSchema = {
  tags: ["Group Task Details"],
  description: "Create a new task in a swimlane",
  body: {
    type: "object",
    required: ["swimlaneId", "content", "taskDate"],
    properties: {
      swimlaneId: { type: "string" },
      content: { type: "string" },
      status: { type: "string" },
      priority: { type: "string" },
      detail: { type: "string" },
      taskDate: { type: "string" },
    },
  },
  response: {
    201: {
      type: "object",
      properties: {
        data: {
          type: "object",
        },
      },
    },
    400: { type: "object" },
    401: { type: "object" },
    403: { type: "object" },
    404: { type: "object" },
    500: { type: "object" },
  },
};

export const updateGroupTaskDetailRouteSchema = {
  tags: ["Group Task Details"],
  description: "Update a task detail",
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
      status: { type: "string" },
      priority: { type: "string" },
      detail: { type: "string" },
      taskDate: { type: "string" },
    },
  },
  response: {
    200: {
      type: "object",
      properties: {
        data: {
          type: "object",
        },
      },
    },
    400: { type: "object" },
    401: { type: "object" },
    403: { type: "object" },
    404: { type: "object" },
    500: { type: "object" },
  },
};

export const deleteGroupTaskDetailRouteSchema = {
  tags: ["Group Task Details"],
  description: "Delete a task detail",
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
    400: { type: "object" },
    401: { type: "object" },
    403: { type: "object" },
    404: { type: "object" },
    500: { type: "object" },
  },
};

export const assignSwimlaneRouteSchema = {
  tags: ["Group Swimlanes"],
  description: "Assign a swimlane to a user",
  params: {
    type: "object",
    required: ["swimlaneId"],
    properties: {
      swimlaneId: { type: "string" },
    },
  },
  body: {
    type: "object",
    required: ["assignedUserId"],
    properties: {
      assignedUserId: { type: "string" },
    },
  },
  response: {
    200: {
      type: "object",
      properties: {
        data: {
          type: "object",
        },
      },
    },
    400: { type: "object" },
    401: { type: "object" },
    403: { type: "object" },
    404: { type: "object" },
    500: { type: "object" },
  },
};
