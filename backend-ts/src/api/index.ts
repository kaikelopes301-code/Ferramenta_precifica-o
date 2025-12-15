/**
 * API Application Builder - V4 with Phase 2 Routes
 * 
 * Includes history and favorites management endpoints
 */

import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import './fastifyDecorations.js';
import { initializeSearchEngine } from './searchRoutes.js';
import { registerRoutes } from './registerRoutes.js';
import { registerRateLimiter } from './middleware/rateLimiter.js';
import requestLoggerPlugin from './middleware/requestLogger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { config } from '../config/env.js';
import { logger } from '../infra/logging.js';

export function buildApp(): FastifyInstance {
  const app = Fastify({
    logger: config.enableRequestLogging
      ? {
        level: config.logLevel,
        transport:
          config.nodeEnv === 'development'
            ? {
              target: 'pino-pretty',
              options: {
                translateTime: 'HH:MM:ss Z',
                ignore: 'pid,hostname',
              },
            }
            : undefined,
      }
      : false,
    genReqId: () => Math.random().toString(36).substring(7),
  });

  // CORS (FIRST)
  void app.register(cors, {
    origin: config.nodeEnv === 'production' ? process.env.FRONTEND_URL || true : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });

  // Cookie support (for user identification)
  void app.register(cookie);

  // Rate limiter (SECOND)
  void app.register(registerRateLimiter);

  // Request logger (THIRD)
  void app.register(requestLoggerPlugin);

  // Routes (FOURTH)
  registerRoutes(app);

  // Error handler (LAST)
  app.setErrorHandler(errorHandler);

  logger.info('[API] ✅ Fastify app built');
  logger.info('[API] 📡 Routes registered via src/api/registerRoutes.ts');

  return app;
}

export async function initializeApp(): Promise<FastifyInstance> {
  logger.info('[API] 🚀 Initializing application...');

  try {
    logger.info('[API] 🔍 Initializing search engine...');
    await initializeSearchEngine();
    logger.info('[API] ✅ Search engine ready');

    logger.info('[API] 🏗️  Building Fastify app...');
    const app = buildApp();
    logger.info('[API] ✅ App built successfully');

    logger.info('[API] 🎉 Application initialized successfully');
    return app;
  } catch (error) {
    logger.error('[API] ❌ Failed to initialize app:', error);
    throw error;
  }
}
