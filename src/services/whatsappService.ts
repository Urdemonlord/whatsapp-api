/**
 * WhatsApp Service
 * 
 * Manages all WhatsApp connections, sessions, and message handling.
 * Uses a global Map to store active socket connections.
 */

import makeWASocket, {
  DisconnectReason,
  WASocket,
  ConnectionState,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import { useSequelizeAuthState } from '../lib/whatsappAuth';
import { Session, SessionStatus } from '../models/Session';
import { AuthKey } from '../models/AuthKey';
import { env } from '../config/env';
import QRCode from 'qrcode';
import pino from 'pino';

// Logger for Baileys (set to silent in production)
const logger = pino({ level: env.isDev ? 'debug' : 'silent' });

/**
 * Active sessions storage
 * Key: session_id
 * Value: WASocket instance
 */
export const sessions = new Map<string, WASocket>();

/**
 * QR code storage for pending connections
 * Key: session_id
 * Value: QR code data URL
 */
export const qrCodes = new Map<string, string>();

/**
 * Reconnection retry counters
 * Key: session_id
 * Value: retry count
 */
const retryCounters = new Map<string, number>();

/**
 * Check if a session exists and is connected
 */
export function isSessionConnected(sessionId: string): boolean {
  const socket = sessions.get(sessionId);
  return socket?.user !== undefined;
}

/**
 * Get session socket
 */
export function getSession(sessionId: string): WASocket | undefined {
  return sessions.get(sessionId);
}

/**
 * Create a new WhatsApp session
 */
export async function createSession(
  sessionId: string,
  userId: string
): Promise<{
  success: boolean;
  qr?: string;
  message: string;
}> {
  try {
    // Check if session already exists
    if (sessions.has(sessionId)) {
      const socket = sessions.get(sessionId)!;
      if (socket.user) {
        return {
          success: true,
          message: 'Session already connected',
        };
      }
      
      // Return existing QR if available
      const existingQr = qrCodes.get(sessionId);
      if (existingQr) {
        return {
          success: true,
          qr: existingQr,
          message: 'Waiting for QR scan',
        };
      }
    }

    // Create or update session in database
    const [session] = await Session.findOrCreate({
      where: { session_id: sessionId },
      defaults: {
        session_id: sessionId,
        user_id: userId,
        status: SessionStatus.CONNECTING,
      },
    });

    // Initialize auth state from database
    const { state, saveCreds, deleteSession } = await useSequelizeAuthState(sessionId);

    // Fetch latest Baileys version
    const { version } = await fetchLatestBaileysVersion();

    // Create WhatsApp socket connection
    const socket = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger),
      },
      logger,
      printQRInTerminal: env.isDev,
      browser: ['WhatsApp API Gateway', 'Chrome', '120.0.0'],
      generateHighQualityLinkPreview: false,
      // Minimal store to save memory
      getMessage: async () => undefined,
    });

    // Store socket in memory
    sessions.set(sessionId, socket);
    retryCounters.set(sessionId, 0);

    // Handle connection updates
    socket.ev.on('connection.update', async (update: Partial<ConnectionState>) => {
      await handleConnectionUpdate(sessionId, session, update, saveCreds, deleteSession);
    });

    // Save credentials when updated
    socket.ev.on('creds.update', saveCreds);

    // Handle messages (optional - for webhook)
    socket.ev.on('messages.upsert', async (m) => {
      if (session.webhook_url) {
        await sendWebhook(session.webhook_url, {
          event: 'messages.upsert',
          sessionId,
          data: m,
        });
      }
    });

    return {
      success: true,
      message: 'Session created, waiting for QR code',
    };
  } catch (error) {
    console.error(`[WA] Error creating session ${sessionId}:`, error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Handle connection state updates
 */
async function handleConnectionUpdate(
  sessionId: string,
  session: Session,
  update: Partial<ConnectionState>,
  saveCreds: () => Promise<void>,
  deleteSessionAuth: () => Promise<void>
): Promise<void> {
  const { connection, lastDisconnect, qr } = update;

  // Generate QR code if available
  if (qr) {
    try {
      const qrDataUrl = await QRCode.toDataURL(qr);
      qrCodes.set(sessionId, qrDataUrl);
      await session.updateStatus(SessionStatus.QR_READY);
      console.log(`[WA] QR code ready for session: ${sessionId}`);
    } catch (error) {
      console.error(`[WA] Error generating QR:`, error);
    }
  }

  // Handle connection state changes
  if (connection === 'close') {
    const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
    const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

    console.log(`[WA] Connection closed for ${sessionId}. Status: ${statusCode}`);

    // Remove QR code
    qrCodes.delete(sessionId);

    if (shouldReconnect) {
      // Check retry limit
      const retries = retryCounters.get(sessionId) || 0;
      
      if (retries < env.wa.maxReconnectRetries) {
        retryCounters.set(sessionId, retries + 1);
        console.log(`[WA] Reconnecting ${sessionId}... (attempt ${retries + 1})`);
        
        // Wait before reconnecting
        await new Promise((resolve) => setTimeout(resolve, env.wa.reconnectInterval));
        
        // Remove old socket
        sessions.delete(sessionId);
        
        // Reconnect
        const userId = session.user_id;
        await createSession(sessionId, userId);
      } else {
        console.log(`[WA] Max retries reached for ${sessionId}`);
        await session.updateStatus(SessionStatus.DISCONNECTED);
        sessions.delete(sessionId);
      }
    } else {
      // Logged out - clean up completely
      console.log(`[WA] Session ${sessionId} logged out`);
      await session.updateStatus(SessionStatus.LOGGED_OUT);
      await deleteSessionAuth();
      sessions.delete(sessionId);
    }
  }

  if (connection === 'open') {
    console.log(`[WA] Session ${sessionId} connected!`);
    qrCodes.delete(sessionId);
    retryCounters.set(sessionId, 0);
    
    const socket = sessions.get(sessionId);
    if (socket?.user) {
      session.phone_number = socket.user.id.split(':')[0];
      session.name = socket.user.name || '';
    }
    
    await session.updateStatus(SessionStatus.CONNECTED);
    await saveCreds();
  }
}

/**
 * Delete a WhatsApp session
 */
export async function deleteSession(sessionId: string): Promise<boolean> {
  try {
    // Get socket and logout
    const socket = sessions.get(sessionId);
    if (socket) {
      await socket.logout();
      sessions.delete(sessionId);
    }

    // Delete from database
    await Session.destroy({ where: { session_id: sessionId } });
    await AuthKey.destroy({ where: { session_id: sessionId } });

    // Clean up
    qrCodes.delete(sessionId);
    retryCounters.delete(sessionId);

    console.log(`[WA] Session ${sessionId} deleted`);
    return true;
  } catch (error) {
    console.error(`[WA] Error deleting session ${sessionId}:`, error);
    return false;
  }
}

/**
 * Get session status
 */
export async function getSessionStatus(sessionId: string): Promise<{
  exists: boolean;
  connected: boolean;
  status: SessionStatus | null;
  phoneNumber?: string;
  name?: string;
  qr?: string;
}> {
  const session = await Session.findOne({ where: { session_id: sessionId } });
  
  if (!session) {
    return {
      exists: false,
      connected: false,
      status: null,
    };
  }

  const socket = sessions.get(sessionId);
  const qr = qrCodes.get(sessionId);

  return {
    exists: true,
    connected: socket?.user !== undefined,
    status: session.status,
    phoneNumber: session.phone_number,
    name: session.name,
    qr,
  };
}

/**
 * Restore all sessions from database on startup
 */
export async function restoreAllSessions(): Promise<void> {
  try {
    const activeSessions = await Session.findAll({
      where: {
        status: [SessionStatus.CONNECTED, SessionStatus.CONNECTING, SessionStatus.QR_READY],
      },
    });

    console.log(`[WA] Restoring ${activeSessions.length} sessions...`);

    for (const session of activeSessions) {
      try {
        await createSession(session.session_id, session.user_id);
        console.log(`[WA] Restored session: ${session.session_id}`);
      } catch (error) {
        console.error(`[WA] Failed to restore ${session.session_id}:`, error);
      }
    }

    console.log(`[WA] Session restoration complete`);
  } catch (error) {
    console.error('[WA] Error restoring sessions:', error);
  }
}

/**
 * Send webhook notification
 */
async function sendWebhook(url: string, data: unknown): Promise<void> {
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  } catch (error) {
    console.error('[WA] Webhook error:', error);
  }
}

/**
 * Gracefully close all sessions
 */
export async function closeAllSessions(): Promise<void> {
  console.log(`[WA] Closing ${sessions.size} sessions...`);
  
  for (const [sessionId, socket] of sessions) {
    try {
      socket.end(undefined);
      console.log(`[WA] Closed session: ${sessionId}`);
    } catch (error) {
      console.error(`[WA] Error closing ${sessionId}:`, error);
    }
  }
  
  sessions.clear();
  qrCodes.clear();
  retryCounters.clear();
}

export default {
  sessions,
  createSession,
  deleteSession,
  getSession,
  getSessionStatus,
  isSessionConnected,
  restoreAllSessions,
  closeAllSessions,
};
