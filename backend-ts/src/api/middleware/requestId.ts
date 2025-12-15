/**
 * Request ID Middleware
 * Injects unique request ID for tracing
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID } from 'crypto';

export async function requestIdMiddleware(
    request: FastifyRequest,
    reply: FastifyReply
): Promise<void> {
    // Generate or use existing request ID
    const requestId = (request.headers['x-request-id'] as string) || randomUUID();

    // Add to request
    request.id = requestId;

    // Add to response headers
    reply.header('x-request-id', requestId);
}
