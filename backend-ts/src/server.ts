/**
 * Server Bootstrap - V3 with Database
 * 
 * Starts the Fastify server with database initialization
 */

import { initializeApp } from './api/index.js';
import { config } from './config/env.js';
import { logger } from './infra/logging.js';
import { initializeDatabase } from './infra/database/connection.js';
import { registerShutdownHandlers } from './domain/services/analytics/shutdownHook.js';

async function start(): Promise<void> {
  try {
    logger.info({
      env: config.nodeEnv,
      rerankEnabled: config.searchRerankerEnabled,
    }, '🚀 Starting AFM Precificação Backend (TypeScript)');

    // Initialize database first
    logger.info('📦 Initializing database...');
    await initializeDatabase();
    logger.info('✅ Database ready');

    // Initialize app (includes search engine initialization)
    const app = await initializeApp();

    // Start listening
    await app.listen({
      port: config.port,
      host: '0.0.0.0',
    });

    if (config.nodeEnv !== 'production' && process.env.PRINT_ROUTES === 'true') {
      const routes = app.getRegisteredRoutes?.() ?? [];
      const sorted = routes
        .slice()
        .sort((a, b) =>
          a.path === b.path
            ? a.method.localeCompare(b.method)
            : a.path.localeCompare(b.path)
        );

      logger.info(`[Routes] Registered routes (${sorted.length}):`);
      for (const r of sorted) {
        logger.info(`[Routes] ${r.method.padEnd(7)} ${r.path}  (${r.source})`);
      }
    }

    logger.info({
      port: config.port,
      env: config.nodeEnv,
      endpoints: {
        root: '/',
        health: '/api/health',
        search: '/api/search',
        details: '/api/detalhes/:grupo',
        metrics: '/api/metrics',
      },
    }, '✅ Server ready');

    // Register graceful shutdown handlers
    registerShutdownHandlers();
  } catch (err) {
    logger.error('❌ Failed to start server', { error: String(err) });
    process.exit(1);
  }
}

start().catch((err: unknown) => {
  console.error('💥 Fatal error during startup:', err);
  process.exit(1);
});
