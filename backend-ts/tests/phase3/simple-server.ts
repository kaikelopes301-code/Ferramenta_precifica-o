/**
 * Phase 3 Simple HTTP Server
 * 
 * Standalone server for Kit & Budget endpoints testing
 * Port 3002 (avoids conflict with Phase 2)
 */

import 'reflect-metadata';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { initializeDatabase } from '../../src/infra/database/connection.js';
import { KitRepository } from '../../src/domain/repositories/KitRepository.js';
import { getUserId } from '../../src/api/middleware/userIdentification.js';
import { z } from 'zod';

const PORT = 3002;

// Validation schemas
const addKitItemSchema = z.object({
    item_name: z.string().min(1).max(500),
    price: z.number().nullable().optional(),
    qty: z.number().int().min(1).max(9999),
});

const updateQtySchema = z.object({
    qty: z.number().int().min(1).max(9999),
});

async function start() {
    console.log('🚀 Starting Phase 3 Server - Kit & Budget...\n');

    // Initialize database
    console.log('📦 Initializing database...');
    await initializeDatabase();
    console.log('✅ Database ready\n');

    // Create app
    const app = Fastify({ logger: false });

    // CORS
    await app.register(cors, { origin: true });

    // Repository
    const repo = new KitRepository();

    // Health check
    app.get('/health', async () => ({ status: 'ok', phase: 3 }));

    // GET /api/kit - List items
    app.get('/api/kit', async (request, reply) => {
        try {
            const userId = getUserId(request);
            const items = await repo.findAll({ user_id: userId });

            return {
                items: items.map(item => ({
                    id: item.id,
                    item_name: item.item_name,
                    price: item.price,
                    qty: item.qty,
                    subtotal: (item.price || 0) * (item.qty || 1),
                    created_at: item.created_at,
                })),
            };
        } catch (error) {
            return reply.code(500).send({ error: 'Internal error' });
        }
    });

    // POST /api/kit - Add item
    app.post('/api/kit', async (request, reply) => {
        try {
            const userId = getUserId(request);
            const body = request.body as any;

            // Validate
            const data = addKitItemSchema.parse(body);

            const item = await repo.create({
                user_id: userId,
                item_name: data.item_name,
                price: data.price ?? null,
                qty: data.qty,
            });

            return reply.code(201).send({ success: true, id: item.id });
        } catch (error) {
            if (error instanceof z.ZodError) {
                return reply.code(400).send({ error: 'Validation error', details: error.errors });
            }
            return reply.code(500).send({ error: 'Internal error' });
        }
    });

    // DELETE /api/kit/:id - Remove item
    app.delete('/api/kit/:id', async (request, reply) => {
        try {
            const userId = getUserId(request);
            const params = request.params as any;
            const id = parseInt(params.id);

            if (isNaN(id) || id < 1) {
                return reply.code(400).send({ error: 'Invalid ID' });
            }

            const deleted = await repo.deleteByIdAndUser(id, userId);

            if (!deleted) {
                return reply.code(404).send({ error: 'Not found' });
            }

            return { success: true };
        } catch (error) {
            return reply.code(500).send({ error: 'Internal error' });
        }
    });

    // GET /api/kit/budget - Calculate budget
    app.get('/api/kit/budget', async (request, reply) => {
        try {
            const userId = getUserId(request);

            const budget = await repo.calculateBudget(userId);
            const items = await repo.findAll({ user_id: userId });

            const totalItems = items.length;
            const totalUnits = items.reduce((sum, item) => sum + (item.qty || 1), 0);

            return {
                items: budget.items.map((budgetItem, idx) => ({
                    id: items[idx]?.id,
                    item_name: budgetItem.item,
                    price: budgetItem.price,
                    qty: budgetItem.qty,
                    subtotal: budgetItem.subtotal,
                })),
                summary: {
                    total_items: totalItems,
                    total_units: totalUnits,
                    subtotal: budget.total,
                    tax: 0.0,
                    total: budget.total,
                },
            };
        } catch (error) {
            return reply.code(500).send({ error: 'Internal error' });
        }
    });

    // PATCH /api/kit/:id - Update quantity
    app.patch('/api/kit/:id', async (request, reply) => {
        try {
            const userId = getUserId(request);
            const params = request.params as any;
            const id = parseInt(params.id);
            const body = request.body as any;

            if (isNaN(id) || id < 1) {
                return reply.code(400).send({ error: 'Invalid ID' });
            }

            // Validate body
            const { qty } = updateQtySchema.parse(body);

            // Check ownership
            const item = await repo.findById(id);
            if (!item || item.user_id !== userId) {
                return reply.code(404).send({ error: 'Not found' });
            }

            // Update
            await repo.update(id, { qty });

            return { success: true };
        } catch (error) {
            if (error instanceof z.ZodError) {
                return reply.code(400).send({ error: 'Validation error' });
            }
            return reply.code(500).send({ error: 'Internal error' });
        }
    });

    // Start
    await app.listen({ port: PORT, host: '0.0.0.0' });

    console.log('✅ Server listening on port', PORT);
    console.log('📡 Endpoints:');
    console.log(`   - GET  http://localhost:${PORT}/health`);
    console.log(`   - GET  http://localhost:${PORT}/api/kit`);
    console.log(`   - POST http://localhost:${PORT}/api/kit`);
    console.log(`   - DELETE http://localhost:${PORT}/api/kit/:id`);
    console.log(`   - GET  http://localhost:${PORT}/api/kit/budget`);
    console.log(`   - PATCH http://localhost:${PORT}/api/kit/:id`);
    console.log('\n🧪 Ready for testing!\n');
}

start().catch(error => {
    console.error('❌ Failed:', error);
    process.exit(1);
});
