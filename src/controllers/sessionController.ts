/**
 * Session Controller
 * 
 * Handles all WhatsApp session-related API endpoints
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import {
  createSession,
  deleteSession,
  getSessionStatus,
  getSession,
  sessions,
  qrCodes,
} from '../services/whatsappService';
import { Session } from '../models/Session';

// Request body types
interface CreateSessionBody {
  session_id?: string;
  webhook_url?: string;
}

interface SessionParams {
  sessionId: string;
}

interface SendMessageBody {
  to: string;
  message: string;
}

/**
 * Create a new WhatsApp session
 * POST /session/create
 */
export async function createSessionHandler(
  request: FastifyRequest<{ Body: CreateSessionBody }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const user = request.user!;
    const { session_id, webhook_url } = request.body || {};

    // Generate session ID if not provided
    const sessionId = session_id || `session_${uuidv4().slice(0, 8)}`;

    // Check if session already exists for another user
    const existingSession = await Session.findOne({
      where: { session_id: sessionId },
    });

    if (existingSession && existingSession.user_id !== user.id) {
      reply.status(400).send({
        success: false,
        error: 'Session ID already exists for another user',
      });
      return;
    }

    // Update webhook URL if provided
    if (existingSession && webhook_url) {
      existingSession.webhook_url = webhook_url;
      await existingSession.save();
    }

    // Create session
    const result = await createSession(sessionId, user.id);

    if (!result.success) {
      reply.status(500).send({
        success: false,
        error: result.message,
      });
      return;
    }

    // Wait a bit for QR code to be generated
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Get QR code if available
    const qr = qrCodes.get(sessionId);
    const status = await getSessionStatus(sessionId);

    reply.send({
      success: true,
      data: {
        session_id: sessionId,
        status: status.status,
        connected: status.connected,
        qr: qr || status.qr,
        message: result.message,
      },
    });
  } catch (error) {
    console.error('[Controller] Create session error:', error);
    reply.status(500).send({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Get session status
 * GET /session/:sessionId/status
 */
export async function getSessionStatusHandler(
  request: FastifyRequest<{ Params: SessionParams }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { sessionId } = request.params;
    const user = request.user!;

    // Verify session belongs to user
    const session = await Session.findOne({
      where: { session_id: sessionId, user_id: user.id },
    });

    if (!session) {
      reply.status(404).send({
        success: false,
        error: 'Session not found',
      });
      return;
    }

    const status = await getSessionStatus(sessionId);

    reply.send({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error('[Controller] Get status error:', error);
    reply.status(500).send({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Get QR code for session
 * GET /session/:sessionId/qr
 */
export async function getQrCodeHandler(
  request: FastifyRequest<{ Params: SessionParams }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { sessionId } = request.params;
    const user = request.user!;

    // Verify session belongs to user
    const session = await Session.findOne({
      where: { session_id: sessionId, user_id: user.id },
    });

    if (!session) {
      reply.status(404).send({
        success: false,
        error: 'Session not found',
      });
      return;
    }

    const qr = qrCodes.get(sessionId);

    if (!qr) {
      reply.status(404).send({
        success: false,
        error: 'QR code not available. Session may already be connected.',
      });
      return;
    }

    reply.send({
      success: true,
      data: { qr },
    });
  } catch (error) {
    console.error('[Controller] Get QR error:', error);
    reply.status(500).send({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Delete a session
 * DELETE /session/:sessionId
 */
export async function deleteSessionHandler(
  request: FastifyRequest<{ Params: SessionParams }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { sessionId } = request.params;
    const user = request.user!;

    // Verify session belongs to user
    const session = await Session.findOne({
      where: { session_id: sessionId, user_id: user.id },
    });

    if (!session) {
      reply.status(404).send({
        success: false,
        error: 'Session not found',
      });
      return;
    }

    const success = await deleteSession(sessionId);

    if (!success) {
      reply.status(500).send({
        success: false,
        error: 'Failed to delete session',
      });
      return;
    }

    reply.send({
      success: true,
      message: 'Session deleted successfully',
    });
  } catch (error) {
    console.error('[Controller] Delete session error:', error);
    reply.status(500).send({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * List all sessions for user
 * GET /sessions
 */
export async function listSessionsHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const user = request.user!;

    const userSessions = await Session.findAll({
      where: { user_id: user.id },
      attributes: ['session_id', 'status', 'phone_number', 'name', 'last_connected', 'created_at'],
    });

    // Add connection status
    const sessionsWithStatus = userSessions.map((s) => ({
      ...s.toJSON(),
      connected: sessions.has(s.session_id) && getSession(s.session_id)?.user !== undefined,
      hasQr: qrCodes.has(s.session_id),
    }));

    reply.send({
      success: true,
      data: sessionsWithStatus,
    });
  } catch (error) {
    console.error('[Controller] List sessions error:', error);
    reply.status(500).send({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Send a text message
 * POST /session/:sessionId/send
 */
export async function sendMessageHandler(
  request: FastifyRequest<{ Params: SessionParams; Body: SendMessageBody }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { sessionId } = request.params;
    const { to, message } = request.body;
    const user = request.user!;

    // Validate input
    if (!to || !message) {
      reply.status(400).send({
        success: false,
        error: 'Missing "to" or "message" in request body',
      });
      return;
    }

    // Verify session belongs to user
    const session = await Session.findOne({
      where: { session_id: sessionId, user_id: user.id },
    });

    if (!session) {
      reply.status(404).send({
        success: false,
        error: 'Session not found',
      });
      return;
    }

    // Get socket
    const socket = getSession(sessionId);

    if (!socket || !socket.user) {
      reply.status(400).send({
        success: false,
        error: 'Session not connected',
      });
      return;
    }

    // Format phone number (add @s.whatsapp.net suffix)
    const jid = to.includes('@') ? to : `${to.replace(/[^0-9]/g, '')}@s.whatsapp.net`;

    // Send message
    const result = await socket.sendMessage(jid, { text: message });

    reply.send({
      success: true,
      data: {
        messageId: result?.key?.id,
        to: jid,
      },
    });
  } catch (error) {
    console.error('[Controller] Send message error:', error);
    reply.status(500).send({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

export default {
  createSessionHandler,
  getSessionStatusHandler,
  getQrCodeHandler,
  deleteSessionHandler,
  listSessionsHandler,
  sendMessageHandler,
};
