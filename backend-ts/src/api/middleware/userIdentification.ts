/**
 * User Identification Middleware
 * 
 * Extracts or generates user identifier from request for user-specific features.
 * Priority: X-User-ID header > Cookie > IP+UA fingerprint
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { createHash } from 'crypto';

export function getUserId(request: FastifyRequest): string {
    // 1. Try X-User-ID header
    const headerUserId = request.headers['x-user-id'];
    if (headerUserId && typeof headerUserId === 'string') {
        return headerUserId;
    }

    // 2. Try cookie
    const cookieUserId = request.cookies?.user_id;
    if (cookieUserId) {
        return cookieUserId;
    }

    // 3. Generate fingerprint from IP + User-Agent
    const ip = request.ip || 'unknown';
    const userAgent = request.headers['user-agent'] || 'unknown';
    const fingerprint = `${ip}:${userAgent}`;

    return createHash('md5').update(fingerprint).digest('hex');
}

/**
 * Fastify plugin to inject user_id into request
 */
export async function userIdentificationPlugin(
    request: FastifyRequest,
    reply: FastifyReply
): Promise<void> {
    // Add user_id to request object
    (request as any).user_id = getUserId(request);
}
