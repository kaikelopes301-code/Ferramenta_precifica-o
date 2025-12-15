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
    logger.info('🚀 Starting AFM Precificação Backend TypeScript v2.0...');
    logger.info(`[RERANK] enabled=${config.searchRerankerEnabled}`);

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

    logger.info(`✅ Server listening on port ${config.port}`);
    logger.info(`📊 Environment: ${config.nodeEnv}`);
    logger.info(`🔍 Search Engine: IntegratedSearchEngine v2.0 (BM25 + Fuzzy + Synonyms)`);
    logger.info(`🌐 CORS: Enabled`);
    logger.info(`📡 Endpoints:`);
    logger.info(`   - POST http://localhost:${config.port}/api/search`);
    logger.info(`   - GET  http://localhost:${config.port}/api/health`);
    logger.info(`   - GET  http://localhost:${config.port}/api/metrics`);
    logger.info(`   - GET  http://localhost:${config.port}/api/history`);
    logger.info(`   - GET/POST/DELETE http://localhost:${config.port}/api/favorites`);
    logger.info(`   - GET/POST/DELETE http://localhost:${config.port}/api/kit`);
    logger.info(`   - GET  http://localhost:${config.port}/api/data/status`);

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
