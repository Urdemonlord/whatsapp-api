/**
 * Route Schemas for OpenAPI Documentation
 * 
 * Defines request/response schemas for all API endpoints
 */

// Common schemas
export const ErrorResponseSchema = {
  type: 'object' as const,
  properties: {
    success: { type: 'boolean' as const, example: false },
    error: { type: 'string' as const },
  },
};

export const SuccessResponseSchema = {
  type: 'object' as const,
  properties: {
    success: { type: 'boolean' as const, example: true },
    message: { type: 'string' as const },
  },
};

// Auth schemas
export const AuthSchemas = {
  register: {
    tags: ['Auth'],
    summary: 'Register new user',
    description: 'Create a new user account (public endpoint)',
    body: {
      type: 'object' as const,
      required: ['username', 'password'],
      properties: {
        username: { type: 'string' as const, minLength: 3 },
        email: { type: 'string' as const, format: 'email' },
        password: { type: 'string' as const, minLength: 6 },
      },
    },
    response: {
      201: {
        type: 'object' as const,
        properties: {
          success: { type: 'boolean' as const },
          data: {
            type: 'object' as const,
            properties: {
              id: { type: 'string' as const },
              username: { type: 'string' as const },
              api_key: { type: 'string' as const },
            },
          },
        },
      },
      400: ErrorResponseSchema,
    },
  },
  login: {
    tags: ['Auth'],
    summary: 'User login',
    description: 'Authenticate and get API key',
    body: {
      type: 'object' as const,
      required: ['username', 'password'],
      properties: {
        username: { type: 'string' as const },
        password: { type: 'string' as const },
      },
    },
    response: {
      200: {
        type: 'object' as const,
        properties: {
          success: { type: 'boolean' as const },
          data: {
            type: 'object' as const,
            properties: {
              id: { type: 'string' as const },
              username: { type: 'string' as const },
              role: { type: 'string' as const },
              api_key: { type: 'string' as const },
            },
          },
        },
      },
      401: ErrorResponseSchema,
    },
  },
};

// Session schemas
export const SessionSchemas = {
  create: {
    tags: ['Session'],
    summary: 'Create WhatsApp session',
    description: 'Create a new WhatsApp session and get QR code',
    security: [{ apiKey: [] }],
    body: {
      type: 'object' as const,
      properties: {
        session_id: { type: 'string' as const, description: 'Optional custom session ID' },
        webhook_url: { type: 'string' as const, format: 'uri', description: 'Webhook URL for events' },
      },
    },
    response: {
      200: {
        type: 'object' as const,
        properties: {
          success: { type: 'boolean' as const },
          data: {
            type: 'object' as const,
            properties: {
              session_id: { type: 'string' as const },
              status: { type: 'string' as const },
              connected: { type: 'boolean' as const },
              qr: { type: 'string' as const, nullable: true },
              message: { type: 'string' as const },
            },
          },
        },
      },
    },
  },
  list: {
    tags: ['Session'],
    summary: 'List sessions',
    description: 'Get all sessions for current user',
    security: [{ apiKey: [] }],
    response: {
      200: {
        type: 'object' as const,
        properties: {
          success: { type: 'boolean' as const },
          data: {
            type: 'array' as const,
            items: {
              type: 'object' as const,
              properties: {
                session_id: { type: 'string' as const },
                status: { type: 'string' as const },
                phone_number: { type: 'string' as const },
                name: { type: 'string' as const },
                connected: { type: 'boolean' as const },
                hasQr: { type: 'boolean' as const },
              },
            },
          },
        },
      },
    },
  },
  status: {
    tags: ['Session'],
    summary: 'Get session status',
    security: [{ apiKey: [] }],
    params: {
      type: 'object' as const,
      properties: {
        sessionId: { type: 'string' as const },
      },
    },
  },
  qr: {
    tags: ['Session'],
    summary: 'Get QR code',
    description: 'Get QR code for session authentication',
    security: [{ apiKey: [] }],
    params: {
      type: 'object' as const,
      properties: {
        sessionId: { type: 'string' as const },
      },
    },
  },
  delete: {
    tags: ['Session'],
    summary: 'Delete session',
    description: 'Logout and delete WhatsApp session',
    security: [{ apiKey: [] }],
    params: {
      type: 'object' as const,
      properties: {
        sessionId: { type: 'string' as const },
      },
    },
  },
};

// Messaging schemas
export const MessagingSchemas = {
  send: {
    tags: ['Messaging'],
    summary: 'Send message',
    description: 'Send text and/or media to individual contact',
    security: [{ apiKey: [] }],
    params: {
      type: 'object' as const,
      properties: {
        sessionId: { type: 'string' as const },
      },
    },
    body: {
      type: 'object' as const,
      required: ['to'],
      properties: {
        to: { type: 'string' as const, description: 'Phone number (e.g., 6281234567890)' },
        message: { type: 'string' as const, description: 'Text message' },
        media: {
          type: 'array' as const,
          description: 'Array of media items',
          items: {
            type: 'object' as const,
            properties: {
              type: { type: 'string' as const, enum: ['image', 'video', 'document', 'audio', 'sticker'] },
              data: { type: 'string' as const, description: 'URL, local path, or base64' },
              caption: { type: 'string' as const },
              filename: { type: 'string' as const },
              mimetype: { type: 'string' as const },
            },
          },
        },
      },
    },
  },
  sendGroup: {
    tags: ['Messaging'],
    summary: 'Send to group',
    description: 'Send message to WhatsApp group',
    security: [{ apiKey: [] }],
    body: {
      type: 'object' as const,
      required: ['groupId'],
      properties: {
        groupId: { type: 'string' as const, description: 'Group JID (e.g., 120363xxx@g.us)' },
        message: { type: 'string' as const },
        media: { type: 'array' as const },
      },
    },
  },
  broadcast: {
    tags: ['Messaging'],
    summary: 'Broadcast message',
    description: 'Send message to multiple recipients with delay',
    security: [{ apiKey: [] }],
    body: {
      type: 'object' as const,
      required: ['recipients'],
      properties: {
        recipients: {
          type: 'array' as const,
          items: { type: 'string' as const },
          description: 'Array of phone numbers',
        },
        message: { type: 'string' as const },
        media: { type: 'array' as const },
        delay: { type: 'number' as const, default: 1000, description: 'Delay in ms between messages' },
      },
    },
  },
};

// Scheduled message schemas
export const ScheduledSchemas = {
  create: {
    tags: ['Scheduled'],
    summary: 'Create scheduled message',
    description: 'Schedule a message to be sent at specific time',
    security: [{ apiKey: [] }],
    body: {
      type: 'object' as const,
      required: ['recipient', 'scheduled_at'],
      properties: {
        recipient: { type: 'string' as const, description: 'Phone number or group JID' },
        recipient_type: { type: 'string' as const, enum: ['individual', 'group'], default: 'individual' },
        message: { type: 'string' as const },
        media: { type: 'array' as const },
        scheduled_at: { type: 'string' as const, format: 'date-time', description: 'ISO 8601 date-time' },
      },
    },
  },
  list: {
    tags: ['Scheduled'],
    summary: 'List pending scheduled messages',
    security: [{ apiKey: [] }],
  },
  history: {
    tags: ['Scheduled'],
    summary: 'Get scheduled message history',
    description: 'Get sent/failed/cancelled messages',
    security: [{ apiKey: [] }],
  },
  get: {
    tags: ['Scheduled'],
    summary: 'Get scheduled message by ID',
    security: [{ apiKey: [] }],
  },
  cancel: {
    tags: ['Scheduled'],
    summary: 'Cancel scheduled message',
    security: [{ apiKey: [] }],
  },
};

// Group schemas
export const GroupSchemas = {
  list: {
    tags: ['Groups'],
    summary: 'List all groups',
    description: 'Get all groups the session is participating in',
    security: [{ apiKey: [] }],
  },
  create: {
    tags: ['Groups'],
    summary: 'Create group',
    description: 'Create a new WhatsApp group',
    security: [{ apiKey: [] }],
    body: {
      type: 'object' as const,
      required: ['name', 'participants'],
      properties: {
        name: { type: 'string' as const },
        participants: {
          type: 'array' as const,
          items: { type: 'string' as const },
          description: 'Array of phone numbers to add',
        },
      },
    },
  },
  info: {
    tags: ['Groups'],
    summary: 'Get group info',
    description: 'Get group metadata and participants',
    security: [{ apiKey: [] }],
  },
  addParticipants: {
    tags: ['Groups'],
    summary: 'Add participants',
    description: 'Add members to group',
    security: [{ apiKey: [] }],
    body: {
      type: 'object' as const,
      required: ['participants'],
      properties: {
        participants: { type: 'array' as const, items: { type: 'string' as const } },
      },
    },
  },
  removeParticipants: {
    tags: ['Groups'],
    summary: 'Remove participants',
    description: 'Remove members from group',
    security: [{ apiKey: [] }],
    body: {
      type: 'object' as const,
      required: ['participants'],
      properties: {
        participants: { type: 'array' as const, items: { type: 'string' as const } },
      },
    },
  },
  leave: {
    tags: ['Groups'],
    summary: 'Leave group',
    security: [{ apiKey: [] }],
  },
};

// User schemas
export const UserSchemas = {
  me: {
    tags: ['Users'],
    summary: 'Get current user',
    description: 'Get authenticated user profile',
    security: [{ apiKey: [] }],
  },
  list: {
    tags: ['Users'],
    summary: 'List all users (admin)',
    security: [{ apiKey: [] }],
  },
  create: {
    tags: ['Users'],
    summary: 'Create user (admin)',
    security: [{ apiKey: [] }],
    body: {
      type: 'object' as const,
      required: ['username', 'password'],
      properties: {
        username: { type: 'string' as const },
        email: { type: 'string' as const },
        password: { type: 'string' as const },
        role: { type: 'string' as const, enum: ['admin', 'user'] },
      },
    },
  },
  get: {
    tags: ['Users'],
    summary: 'Get user by ID (admin)',
    security: [{ apiKey: [] }],
  },
  update: {
    tags: ['Users'],
    summary: 'Update user (admin)',
    security: [{ apiKey: [] }],
  },
  delete: {
    tags: ['Users'],
    summary: 'Delete user (admin)',
    security: [{ apiKey: [] }],
  },
  regenerateKey: {
    tags: ['Users'],
    summary: 'Regenerate API key (admin)',
    security: [{ apiKey: [] }],
  },
};

export default {
  AuthSchemas,
  SessionSchemas,
  MessagingSchemas,
  ScheduledSchemas,
  GroupSchemas,
  UserSchemas,
};
