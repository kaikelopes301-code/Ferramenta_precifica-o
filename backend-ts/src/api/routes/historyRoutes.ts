/**
 * History Routes - User Search History
 * 
 * Endpoints for managing user search history.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { SearchHistoryRepository } from '../../domain/repositories/SearchHistoryRepository.js';
import { getUserId } from '../middleware/userIdentification.js';

// Validation schemas
const historyQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
});

const deleteParamsSchema = z.object({
    id: z.coerce.number().int().positive(),
});

export async function historyRoutes(app: FastifyInstance) {
    const repo = new SearchHistoryRepository();

    /**
     * GET /api/history
     * Get user's search history
     */
    app.get('/api/history', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            // Get user ID
            const userId = getUserId(request);

            // Validate query params
            const { limit } = historyQuerySchema.parse(request.query);

            // Get history
            const items = await repo.findAll({ user_id: userId, limit });

            return reply.code(200).send({
                history: items.map(item => ({
                    id: item.id,
                    query: item.query,
                    context_tags: item.context_tags,
                    results_count: item.results_count,
                    created_at: item.created_at,
                })),
            });
        } catch (error) {
            if (error instanceof z.ZodError) {
                return reply.code(400).send({
                    error: 'Validation error',
                    details: error.issues,
                });
            }

            console.error('[HistoryRoutes] Error:', error);
            return reply.code(500).send({
                error: 'Internal server error',
            });
        }
    });

    /**
     * DELETE /api/history/:id
     * Delete a history entry
     */
    app.delete('/api/history/:id', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const userId = getUserId(request);
            const { id } = deleteParamsSchema.parse(request.params);

            // Verify entry belongs to user before deleting
            const entry = await repo.findById(id);
            if (!entry || entry.user_id !== userId) {
                return reply.code(404).send({
                    error: 'History entry not found',
                });
            }

            const deleted = await repo.delete(id);
            
            return reply.code(200).send({
                success: deleted,
            });
        } catch (error) {
            if (error instanceof z.ZodError) {
                return reply.code(400).send({
                    error: 'Validation error',
                    details: error.issues,
                });
            }

            console.error('[HistoryRoutes] DELETE Error:', error);
            return reply.code(500).send({
                error: 'Internal server error',
            });
        }
    });
}
