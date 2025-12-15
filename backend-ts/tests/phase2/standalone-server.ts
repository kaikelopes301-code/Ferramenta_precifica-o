/**
 * Phase 2 Standalone Server
 * 
 * Minimal Fastify server to test history and favorites routes
 * Runs independently of the main server
 */

import 'reflect-metadata';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import { historyRoutes } from '../src/api/routes/historyRoutes.js';
import { favoritesRoutes } from '../src/api/routes/favoritesRoutes.js';
import { initializeDatabase } from '../src/infra/database/connection.js';

const PORT = 3001; // Different port to avoid conflicts

async function start() {
    try {
        console.log('🚀 Starting Phase 2 Standalone Server...\n');

        // Initialize database
        console.log('📦 Initializing database...');
        await initializeDatabase();
        console.log('✅ Database ready\n');

        // Create Fastify app
        const app = Fastify({
            logger: {
                level: 'info',
                transport: {
                    target: 'pino-pretty',
                    options: {
                        translateTime: 'HH:MM:ss',
                        ignore: 'pid,hostname',
                    },
                },
            },
        });

        // Middleware
        await app.register(cors, {
            origin: true,
            credentials: true,
        });

        await app.register(cookie);

        // Health check
        app.get('/health', async () => ({ status: 'ok', phase: 2 }));

        // Register Phase 2 routes
        await app.register(historyRoutes);
        await app.register(favoritesRoutes);

        // Start server
        await app.listen({ port: PORT, host: '0.0.0.0' });

        console.log('✅ Server listening');
        console.log(`📡 Endpoints available at http://localhost:${PORT}:`);
        console.log('   - GET  /health');
        console.log('   - GET  /api/history');
        console.log('   - GET  /api/favorites');
        console.log('   - POST /api/favorites');
        console.log('   - DELETE /api/favorites/:id');
        console.log('\n🧪 Ready for testing!\n');
    } catch (error) {
        console.error('❌ Failed to start:', error);
        process.exit(1);
    }
}

start();
