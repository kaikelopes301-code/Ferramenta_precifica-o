/**
 * Shutdown Hook - Graceful Shutdown Coordinator
 * 
 * Centralizes cleanup logic for graceful server shutdown:
 * - Flushes analytics buffer to database
 * - Closes database connections
 * - Logs shutdown events
 */

import { AnalyticsService } from './AnalyticsService.js';
import { closeDatabase } from '../../../infra/database/connection.js';
import { logger } from '../../../infra/logging.js';

let isShuttingDown = false;

/**
 * Perform graceful shutdown
 */
async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    logger.warn(`[Shutdown] Already shutting down, ignoring signal: ${signal}`);
    return;
  }

  isShuttingDown = true;
  logger.info(`[Shutdown] 🛑 Received ${signal}, starting graceful shutdown...`);

  try {
    // 1. Flush analytics to database
    logger.info('[Shutdown] 📊 Flushing analytics buffer...');
    const analytics = AnalyticsService.getInstance();
    await analytics.stop();
    logger.info('[Shutdown] ✅ Analytics flushed');

    // 2. Close database connection
    logger.info('[Shutdown] 💾 Closing database connection...');
    await closeDatabase();
    logger.info('[Shutdown] ✅ Database closed');

    logger.info('[Shutdown] 👋 Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error('[Shutdown] ❌ Error during shutdown:', error);
    process.exit(1);
  }
}

/**
 * Register shutdown handlers for SIGINT and SIGTERM
 */
export function registerShutdownHandlers(): void {
  // SIGINT - Ctrl+C in terminal
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  // SIGTERM - Process manager kill signal (Docker, PM2, etc.)
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

  // Uncaught exceptions (emergency flush)
  process.on('uncaughtException', async (error) => {
    logger.error('[Shutdown] 💥 Uncaught exception:', error);
    await gracefulShutdown('UNCAUGHT_EXCEPTION');
  });

  // Unhandled promise rejections (emergency flush)
  process.on('unhandledRejection', async (reason) => {
    logger.error('[Shutdown] 💥 Unhandled rejection:', reason);
    await gracefulShutdown('UNHANDLED_REJECTION');
  });

  logger.info('[Shutdown] ✅ Shutdown handlers registered');
}
