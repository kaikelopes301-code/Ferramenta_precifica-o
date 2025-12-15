/**
 * Kit Routes - Equipment Kit Management
 * 
 * Endpoints for managing user's equipment kit and budget calculations.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { KitRepository } from '../../domain/repositories/KitRepository.js';
import { getUserId } from '../middleware/userIdentification.js';

// Validation schemas
const addKitItemSchema = z.object({
    item_name: z.string().min(1).max(500),
    price: z.number().nullable().optional(),
    qty: z.number().int().min(1).max(9999),
});

const updateQtySchema = z.object({
    qty: z.number().int().min(1).max(9999),
});

const deleteParamsSchema = z.object({
    id: z.coerce.number().int().positive(),
});

export async function kitRoutes(app: FastifyInstance) {
    const repo = new KitRepository();

    /**
     * GET /api/kit
     * List user's kit items
     */
    app.get('/api/kit', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const userId = getUserId(request);

            const items = await repo.findAll({ user_id: userId });

            return reply.code(200).send({
                items: items.map(item => ({
                    id: item.id,
                    item_name: item.item_name,
                    price: item.price,
                    qty: item.qty,
                    subtotal: (item.price || 0) * (item.qty || 1),
                    created_at: item.created_at,
                })),
            });
        } catch (error) {
            console.error('[KitRoutes] GET Error:', error);
            return reply.code(500).send({
                error: 'Internal server error',
            });
        }
    });

    /**
     * POST /api/kit
     * Add item to kit
     */
    app.post('/api/kit', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const userId = getUserId(request);

            // Validate body
            const data = addKitItemSchema.parse(request.body);

            // Create kit item
            const kitItem = await repo.create({
                user_id: userId,
                item_name: data.item_name,
                price: data.price ?? null,
                qty: data.qty,
            });

            return reply.code(201).send({
                success: true,
                id: kitItem.id,
            });
        } catch (error) {
            if (error instanceof z.ZodError) {
                return reply.code(400).send({
                    error: 'Validation error',
                    details: error.issues,
                });
            }

            console.error('[KitRoutes] POST Error:', error);
            return reply.code(500).send({
                error: 'Internal server error',
            });
        }
    });

    /**
     * DELETE /api/kit/:id
     * Remove item from kit
     */
    app.delete<{ Params: { id: string } }>(
        '/api/kit/:id',
        async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
            try {
                const userId = getUserId(request);

                // Validate params
                const { id } = deleteParamsSchema.parse(request.params);

                // Delete (with user isolation)
                const deleted = await repo.deleteByIdAndUser(id, userId);

                if (!deleted) {
                    return reply.code(404).send({
                        error: 'Kit item not found or does not belong to user',
                    });
                }

                return reply.code(200).send({
                    success: true,
                });
            } catch (error) {
                if (error instanceof z.ZodError) {
                    return reply.code(400).send({
                        error: 'Validation error',
                        details: error.issues,
                    });
                }

                console.error('[KitRoutes] DELETE Error:', error);
                return reply.code(500).send({
                    error: 'Internal server error',
                });
            }
        }
    );

    /**
     * GET /api/kit/budget
     * Calculate total budget for user's kit
     */
    app.get('/api/kit/budget', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const userId = getUserId(request);

            const budget = await repo.calculateBudget(userId);

            const items = await repo.findAll({ user_id: userId });

            // Calculate summary
            const totalItems = items.length;
            const totalUnits = items.reduce((sum, item) => sum + (item.qty || 1), 0);

            return reply.code(200).send({
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
            });
        } catch (error) {
            console.error('[KitRoutes] BUDGET Error:', error);
            return reply.code(500).send({
                error: 'Internal server error',
            });
        }
    });

    /**
     * PATCH /api/kit/:id
     * Update item quantity
     */
    app.patch<{ Params: { id: string } }>(
        '/api/kit/:id',
        async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
            try {
                const userId = getUserId(request);

                // Validate params
                const { id } = deleteParamsSchema.parse(request.params);

                // Validate body
                const { qty } = updateQtySchema.parse(request.body);

                // Check if item belongs to user
                const item = await repo.findById(id);
                if (!item || item.user_id !== userId) {
                    return reply.code(404).send({
                        error: 'Kit item not found or does not belong to user',
                    });
                }

                // Update quantity
                await repo.update(id, { qty });

                return reply.code(200).send({
                    success: true,
                });
            } catch (error) {
                if (error instanceof z.ZodError) {
                    return reply.code(400).send({
                        error: 'Validation error',
                        details: error.issues,
                    });
                }

                console.error('[KitRoutes] PATCH Error:', error);
                return reply.code(500).send({
                    error: 'Internal server error',
                });
            }
        }
    );
}
