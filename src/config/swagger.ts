/**
 * OpenAPI Schema Definitions
 * 
 * Contains all schema definitions and OpenAPI configuration for Swagger
 */

import { FastifySwaggerUiOptions } from '@fastify/swagger-ui';

// Swagger UI configuration
export const swaggerUiConfig: FastifySwaggerUiOptions = {
  routePrefix: '/docs',
  uiConfig: {
    docExpansion: 'list' as const,
    deepLinking: true,
    persistAuthorization: true,
    displayRequestDuration: true,
  },
  staticCSP: true,
};

// OpenAPI configuration
export const swaggerConfig = {
  openapi: {
    info: {
      title: 'WhatsApp API Gateway',
      description: `
# WhatsApp Multi-Device API Gateway

REST API untuk mengirim dan menerima pesan WhatsApp menggunakan Baileys library.

## Authentication

Semua endpoint (kecuali /health dan /api/auth/*) memerlukan API key di header:

\`\`\`
x-api-key: your-api-key-here
\`\`\`

## Rate Limiting

- **100 requests/minute** per IP
- Jika limit terlampaui, response akan error 429

## Media Support

Media dapat dikirim dalam 3 format:
- **URL**: \`https://example.com/image.jpg\`
- **Local Path**: \`C:/Users/path/to/file.pdf\`
- **Base64**: \`data:image/jpeg;base64,/9j/4AAQ...\`

## Webhook Events

Jika webhook URL dikonfigurasi, events berikut akan dikirim:
- \`message.received\` - Pesan masuk
- \`message.status\` - Status pesan (sent/delivered/read)
- \`presence.update\` - Online/offline/typing
      `,
      version: '1.0.0',
      contact: {
        name: 'API Support',
        email: 'support@example.com',
      },
    },
    servers: [
      { url: 'http://localhost:3000', description: 'Development' },
    ],
    tags: [
      { name: 'Health', description: 'Health check endpoints' },
      { name: 'Auth', description: 'Public authentication (no API key required)' },
      { name: 'Session', description: 'WhatsApp session management' },
      { name: 'Messaging', description: 'Send messages (text, media, group, broadcast)' },
      { name: 'Scheduled', description: 'Scheduled messages' },
      { name: 'Groups', description: 'Group management' },
      { name: 'Users', description: 'User management (admin only)' },
    ],
    components: {
      securitySchemes: {
        apiKey: {
          type: 'apiKey' as const,
          name: 'x-api-key',
          in: 'header' as const,
          description: 'API key for authentication',
        },
      },
    },
    security: [{ apiKey: [] }],
  },
};

export default { swaggerConfig, swaggerUiConfig };
