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
import {
  sendToGroupHandler,
  broadcastHandler,
  listGroupsHandler,
  createGroupHandler,
  getGroupInfoHandler,
  addGroupParticipantsHandler,
  removeGroupParticipantsHandler,
  leaveGroupHandler,
  updateWebhookHandler,
} from '../controllers/groupController';
import {
  createScheduledHandler,
  listScheduledHandler,
  getScheduledHandler,
  cancelScheduledHandler,
  historyScheduledHandler,
} from '../controllers/scheduleController';

/**
 * Register session routes
 */
export async function sessionRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions
): Promise<void> {
  // Apply API key authentication to all routes in this plugin
  fastify.addHook('preHandler', apiKeyAuth);

  // ========================================
  // SESSION MANAGEMENT
  // ========================================

  // Create new session
  fastify.post('/session/create', createSessionHandler);

  // List all sessions
  fastify.get('/sessions', listSessionsHandler);

  // Get session status
  fastify.route({ method: 'GET', url: '/session/:sessionId/status', handler: getSessionStatusHandler });

  // Get QR code
  fastify.route({ method: 'GET', url: '/session/:sessionId/qr', handler: getQrCodeHandler });

  // Delete session
  fastify.route({ method: 'DELETE', url: '/session/:sessionId', handler: deleteSessionHandler });

  // Update webhook URL
  fastify.route({ method: 'PUT', url: '/session/:sessionId/webhook', handler: updateWebhookHandler });

  // ========================================
  // MESSAGING
  // ========================================

  // Send message (text and/or media) to individual
  fastify.route({ method: 'POST', url: '/session/:sessionId/send', handler: sendMessageHandler });

  // Send message to group
  fastify.route({ method: 'POST', url: '/session/:sessionId/send-group', handler: sendToGroupHandler });

  // Broadcast to multiple recipients
  fastify.route({ method: 'POST', url: '/session/:sessionId/broadcast', handler: broadcastHandler });

  // ========================================
  // SCHEDULED MESSAGES
  // ========================================

  // Create scheduled message
  fastify.route({ method: 'POST', url: '/session/:sessionId/schedule', handler: createScheduledHandler });

  // List pending scheduled messages
  fastify.route({ method: 'GET', url: '/session/:sessionId/schedule', handler: listScheduledHandler });

  // Get scheduled message history
  fastify.route({ method: 'GET', url: '/session/:sessionId/schedule/history', handler: historyScheduledHandler });

  // Get specific scheduled message
  fastify.route({ method: 'GET', url: '/session/:sessionId/schedule/:messageId', handler: getScheduledHandler });

  // Cancel scheduled message
  fastify.route({ method: 'DELETE', url: '/session/:sessionId/schedule/:messageId', handler: cancelScheduledHandler });

  // ========================================
  // GROUP MANAGEMENT
  // ========================================

  // List all groups
  fastify.route({ method: 'GET', url: '/session/:sessionId/groups', handler: listGroupsHandler });

  // Create new group
  fastify.route({ method: 'POST', url: '/session/:sessionId/groups', handler: createGroupHandler });

  // Get group info
  fastify.route({ method: 'GET', url: '/session/:sessionId/groups/:groupId', handler: getGroupInfoHandler });

  // Add participants to group
  fastify.route({ method: 'POST', url: '/session/:sessionId/groups/:groupId/add', handler: addGroupParticipantsHandler });

  // Remove participants from group
  fastify.route({ method: 'POST', url: '/session/:sessionId/groups/:groupId/remove', handler: removeGroupParticipantsHandler });

  // Leave group
  fastify.route({ method: 'DELETE', url: '/session/:sessionId/groups/:groupId', handler: leaveGroupHandler });
}

export default sessionRoutes;
