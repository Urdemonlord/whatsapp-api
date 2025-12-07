/**
 * Session Routes
 * 
 * All routes for WhatsApp session management
 */

import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { apiKeyAuth } from '../middleware/apiKeyAuth';
import {
  createSessionHandler,
  getSessionStatusHandler,
  getQrCodeHandler,
  deleteSessionHandler,
  listSessionsHandler,
  sendMessageHandler,
} from '../controllers/sessionController';

/**
 * Register session routes
 */
export async function sessionRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions
): Promise<void> {
  // Apply API key authentication to all routes in this plugin
  fastify.addHook('preHandler', apiKeyAuth);

  // Create new session
  fastify.post('/session/create', createSessionHandler);

  // List all sessions
  fastify.get('/sessions', listSessionsHandler);

  // Get session status
  fastify.get<{ Params: { sessionId: string } }>(
    '/session/:sessionId/status',
    getSessionStatusHandler
  );

  // Get QR code
  fastify.get<{ Params: { sessionId: string } }>(
    '/session/:sessionId/qr',
    getQrCodeHandler
  );

  // Delete session
  fastify.delete<{ Params: { sessionId: string } }>(
    '/session/:sessionId',
    deleteSessionHandler
  );

  // Send message
  fastify.post<{ Params: { sessionId: string }; Body: { to: string; message: string } }>(
    '/session/:sessionId/send',
    sendMessageHandler
  );
}

export default sessionRoutes;
