
/**
 * Phase 5 Analytics & Cache Server
 * Port 3005
 */

import 'reflect-metadata';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import path from 'path';
import { AppDataSource, initializeDatabase } from '../../src/infra/database/connection.js';
import { registerSearchRoutes, initializeSearchEngine } from '../../src/api/searchRoutes.js';
import { AnalyticsService } from '../../src/domain/services/analytics/AnalyticsService.js';

// Override DB path for safe testing
process.env.DATABASE_PATH = path.join(process.cwd(), 'data', 'test_phase5.db');
process.env.LOG_LEVEL = 'error';

const PORT = 3005;

async function start() {
    console.log(`🚀 Starting Phase 5 Server on port ${PORT}...`);

    try {
        // 1. Init Database
        await initializeDatabase();

        // 2. Init Search Engine (includes Cache & Cold Start check)
        await initializeSearchEngine();

        const app = Fastify({ logger: false });
        await app.register(cors);

        // 3. Register Routes (Search + Metrics)
        await registerSearchRoutes(app);

        // 4. Debug Endpoint to force flushes
        app.post('/debug/flush-analytics', async () => {
            await AnalyticsService.getInstance().flush();
            return { status: 'flushed' };
        });

        // 5. Debug Endpoint to reset analytics
        app.post('/debug/reset-analytics', async () => {
            const repo = AppDataSource.getRepository('DailyAnalytics');
            await repo.clear();
            return { status: 'cleared' };
        });

        // 6. Inspect analytics data
        app.get('/debug/analytics-data', async () => {
            const repo = AppDataSource.getRepository('DailyAnalytics');
            return await repo.find();
        });

        await app.listen({ port: PORT, host: '0.0.0.0' });
        console.log(`✅ Server listening on port ${PORT}`);
        console.log(`   (Using DB: ${process.env.DATABASE_PATH})`);

    } catch (err) {
        console.error('Fatal start error:', err);
        process.exit(1);
    }
}

start();
