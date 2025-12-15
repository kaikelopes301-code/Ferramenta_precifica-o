/**
 * Rate Limiter Configuration
 * Protects API from abuse - 100 requests/minute
 */

import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance } from 'fastify';

export async function registerRateLimiter(fastify: FastifyInstance): Promise<void> {
    await fastify.register(rateLimit, {
        max: 100, // Max 100 requests
        timeWindow: '1 minute', // Per minute
        cache: 10000, // Cache up to 10k IP addresses
        allowList: ['127.0.0.1'], // Whitelist localhost for development
        errorResponseBuilder: () => {
            return {
                error: {
                    code: 'RATE_LIMIT_EXCEEDED',
                    message: 'Too many requests. Please try again later.',
                },
                retry_after_seconds: 60,
            };
        },
    });
}
