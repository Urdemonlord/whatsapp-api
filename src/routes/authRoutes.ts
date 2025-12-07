/**
 * Auth Routes (Public - No API Key Required)
 * 
 * Endpoints for user registration and login
 */

import { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from 'fastify';
import { User } from '../models/User';

// Request body types
interface RegisterBody {
  username: string;
  email?: string;
  password: string;
}

interface LoginBody {
  username: string;
  password: string;
}

/**
 * Register a new user (PUBLIC - no auth required)
 * POST /auth/register
 */
async function registerHandler(
  request: FastifyRequest<{ Body: RegisterBody }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { username, email, password } = request.body;

    // Validate input
    if (!username || !password) {
      reply.status(400).send({
        success: false,
        error: 'Username and password are required',
      });
      return;
    }

    if (password.length < 6) {
      reply.status(400).send({
        success: false,
        error: 'Password must be at least 6 characters',
      });
      return;
    }

    // Check if username already exists
    const existingUsername = await User.findOne({ where: { username } });
    if (existingUsername) {
      reply.status(400).send({
        success: false,
        error: 'Username already exists',
      });
      return;
    }

    // Check if email already exists (if provided)
    if (email) {
      const existingEmail = await User.findOne({ where: { email } });
      if (existingEmail) {
        reply.status(400).send({
          success: false,
          error: 'Email already exists',
        });
        return;
      }
    }

    // Create user
    const user = await User.create({ username, email, password });

    reply.status(201).send({
      success: true,
      message: 'User registered successfully',
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        api_key: user.api_key,
        created_at: user.createdAt,
      },
    });
  } catch (error) {
    console.error('[Auth] Register error:', error);
    reply.status(500).send({
      success: false,
      error: error instanceof Error ? error.message : 'Registration failed',
    });
  }
}

/**
 * Login and get API key (PUBLIC - no auth required)
 * POST /auth/login
 */
async function loginHandler(
  request: FastifyRequest<{ Body: LoginBody }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { username, password } = request.body;

    // Validate input
    if (!username || !password) {
      reply.status(400).send({
        success: false,
        error: 'Username and password are required',
      });
      return;
    }

    // Find user
    const user = await User.findOne({ where: { username } });
    if (!user) {
      reply.status(401).send({
        success: false,
        error: 'Invalid username or password',
      });
      return;
    }

    // Check if user is active
    if (!user.is_active) {
      reply.status(401).send({
        success: false,
        error: 'Account is disabled',
      });
      return;
    }

    // Verify password
    const isValid = await user.verifyPassword(password);
    if (!isValid) {
      reply.status(401).send({
        success: false,
        error: 'Invalid username or password',
      });
      return;
    }

    // Update last login
    user.last_login = new Date();
    await user.save();

    reply.send({
      success: true,
      message: 'Login successful',
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        api_key: user.api_key,
        last_login: user.last_login,
      },
    });
  } catch (error) {
    console.error('[Auth] Login error:', error);
    reply.status(500).send({
      success: false,
      error: error instanceof Error ? error.message : 'Login failed',
    });
  }
}

/**
 * Register auth routes (PUBLIC - no authentication)
 */
export async function authRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions
): Promise<void> {
  // Register new user
  fastify.post('/auth/register', registerHandler);

  // Login
  fastify.post('/auth/login', loginHandler);
}

export default authRoutes;
