/**
 * Phase 2 Simple HTTP Server
 * 
 * All-in-one server with routes defined inline
 * No external imports needed (except repositories)
 */

import 'reflect-metadata';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { initializeDatabase } from '../../src/infra/database/connection.js';
import { SearchHistoryRepository } from '../../src/domain/repositories/SearchHistoryRepository.js';
import { FavoritesRepository } from '../../src/domain/repositories/FavoritesRepository.js';
import { getUserId } from '../../src/api/middleware/userIdentification.js';

const PORT = 3001;

async function start() {
    console.log('🚀 Starting Phase 2 Simple Server...\n');

    // Initialize database
    console.log('📦 Initializing database...');
    await initializeDatabase();
    console.log('✅ Database ready\n');

    // Create app
    const app = Fastify({ logger: false });

    // CORS
    await app.register(cors, { origin: true });

    // Repositories
    const historyRepo = new SearchHistoryRepository();
    const favRepo = new FavoritesRepository();

    // Health check
    app.get('/health', async () => ({ status: 'ok', phase: 2 }));

    // GET /api/history
    app.get('/api/history', async (request, reply) => {
        try {
            const userId = getUserId(request);
            const limit = parseInt((request.query as any).limit || '20');

            if (limit < 1 || limit > 100) {
                return reply.code(400).send({ error: 'Invalid limit' });
            }

            const items = await historyRepo.findAll({ user_id: userId, limit });

            return { items };
        } catch (error) {
            return reply.code(500).send({ error: 'Internal error' });
        }
    });

    // GET /api/favorites
    app.get('/api/favorites', async (request, reply) => {
        try {
            const userId = getUserId(request);
            const items = await favRepo.findAll({ user_id: userId });

            return {
                items: items.map(item => ({
                    id: item.id,
                    item_name: item.item_name,
                    price: item.price,
                    extra: item.extra ? JSON.parse(item.extra) : null,
                    created_at: item.created_at,
                })),
            };
        } catch (error) {
            return reply.code(500).send({ error: 'Internal error' });
        }
    });

    // POST /api/favorites
    app.post('/api/favorites', async (request, reply) => {
        try {
            const userId = getUserId(request);
            const body = request.body as any;

            if (!body.item_name || typeof body.item_name !== 'string') {
                return reply.code(400).send({ error: 'item_name is required' });
            }

            const favorite = await favRepo.create({
                user_id: userId,
                item_name: body.item_name,
                price: body.price ?? null,
                extra: body.extra ? JSON.stringify(body.extra) : null,
            });

            return reply.code(201).send({ success: true, id: favorite.id });
        } catch (error) {
            return reply.code(500).send({ error: 'Internal error' });
        }
    });

    // DELETE /api/favorites/:id
    app.delete('/api/favorites/:id', async (request, reply) => {
        try {
            const userId = getUserId(request);
            const params = request.params as any;
            const id = parseInt(params.id);

            if (isNaN(id) || id < 1) {
                return reply.code(400).send({ error: 'Invalid ID' });
            }

            const deleted = await favRepo.deleteByIdAndUser(id, userId);

            if (!deleted) {
                return reply.code(404).send({ error: 'Not found' });
            }

            return { success: true };
        } catch (error) {
            return reply.code(500).send({ error: 'Internal error' });
        }
    });

    // Start
    await app.listen({ port: PORT, host: '0.0.0.0' });

    console.log('✅ Server listening on port', PORT);
    console.log('📡 Endpoints:');
    console.log(`   - GET  http://localhost:${PORT}/health`);
    console.log(`   - GET  http://localhost:${PORT}/api/history`);
    console.log(`   - GET  http://localhost:${PORT}/api/favorites`);
    console.log(`   - POST http://localhost:${PORT}/api/favorites`);
    console.log(`   - DELETE http://localhost:${PORT}/api/favorites/:id`);
    console.log('\n🧪 Ready for testing!\n');
}

start().catch(error => {
    console.error('❌ Failed:', error);
    process.exit(1);
});
