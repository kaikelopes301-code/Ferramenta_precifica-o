/**
 * Search Request Validation Schema
 * Uses Zod for runtime type validation
 */

import { z } from 'zod';

/**
 * POST /api/search request schema
 */
export const searchRequestSchema = z.object({
    query: z.string()
        .min(1, 'Query cannot be empty')
        .max(500, 'Query too long (max 500 chars)')
        .trim(),

    top_k: z.number()
        .int('top_k must be an integer')
        .min(1, 'top_k must be at least 1')
        .optional()
        .default(10),

    min_score: z.number()
        .min(0, 'min_score must be non-negative')
        .max(1, 'min_score cannot exceed 1')
        .optional()
        .default(0.0),

    use_cache: z.boolean()
        .optional()
        .default(true),
});

export type SearchRequest = z.infer<typeof searchRequestSchema>;

/**
 * Batch search request schema
 */
export const batchSearchRequestSchema = z.object({
    queries: z.array(z.string().min(1).max(500))
        .min(1, 'Must provide at least one query')
        .max(50, 'Cannot exceed 50 queries in batch'),

    top_k: z.number()
        .int()
        .min(1)
        .optional()
        .default(10),
});

export type BatchSearchRequest = z.infer<typeof batchSearchRequestSchema>;
