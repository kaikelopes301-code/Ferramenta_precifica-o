/**
 * Favorites Routes - User Favorites Management
 * 
 * Endpoints for managing user favorite items.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { FavoritesRepository } from '../../domain/repositories/FavoritesRepository.js';
import { getUserId } from '../middleware/userIdentification.js';

// Validation schemas
const addFavoriteSchema = z.object({
    item_name: z.string().min(1).max(500),
    price: z.number().nullable().optional(),
    extra: z.record(z.string(), z.unknown()).optional(),
});

const deleteParamsSchema = z.object({
    id: z.coerce.number().int().positive(),
});

export async function favoritesRoutes(app: FastifyInstance) {
    const repo = new FavoritesRepository();

    /**
     * GET /api/favorites
     * List user's favorites
     */
    app.get('/api/favorites', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const userId = getUserId(request);

            const items = await repo.findAll({ user_id: userId });

            return reply.code(200).send({
                favorites: items.map(item => ({
                    id: item.id,
                    item_name: item.item_name,
                    price: item.price,
                    extra: item.extra ? JSON.parse(item.extra) : null,
                    created_at: item.created_at,
                })),
            });
        } catch (error) {
            console.error('[FavoritesRoutes] GET Error:', error);
            return reply.code(500).send({
                error: 'Internal server error',
            });
        }
    });

    /**
     * POST /api/favorites
     * Add item to favorites
     */
    app.post('/api/favorites', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const userId = getUserId(request);

            // Validate and parse body
            const data = addFavoriteSchema.parse(request.body);

            // Create favorite
            const favorite = await repo.create({
                user_id: userId,
                item_name: data.item_name,
                price: data.price ?? null,
                extra: data.extra ? JSON.stringify(data.extra) : null,
            });

            return reply.code(201).send({
                success: true,
                id: favorite.id,
            });
        } catch (error) {
            if (error instanceof z.ZodError) {
                return reply.code(400).send({
                    error: 'Validation error',
                    details: error.issues,
                });
            }

            console.error('[FavoritesRoutes] POST Error:', error);
            return reply.code(500).send({
                error: 'Internal server error',
            });
        }
    });

    /**
     * DELETE /api/favorites/:id
     * Remove item from favorites
     */
    app.delete<{ Params: { id: string } }>(
        '/api/favorites/:id',
        async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
            try {
                const userId = getUserId(request);

                // Validate params
                const { id } = deleteParamsSchema.parse(request.params);

                // Delete (with user isolation)
                const deleted = await repo.deleteByIdAndUser(id, userId);

                if (!deleted) {
                    return reply.code(404).send({
                        error: 'Favorite not found or does not belong to user',
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

                console.error('[FavoritesRoutes] DELETE Error:', error);
                return reply.code(500).send({
                    error: 'Internal server error',
                });
            }
        }
    );
}
