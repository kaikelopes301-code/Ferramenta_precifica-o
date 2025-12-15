/**
 * Request Logger Middleware
 * Structured logging for all requests
 */

import type { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import fastifyPlugin from 'fastify-plugin';
import { logger } from '../../infra/logging.js';

async function requestLoggerPlugin(fastify: FastifyInstance) {
    fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
        const startTime = Date.now();

        // Store start time in request
        (request as any).startTime = startTime;

        // Log incoming request
        logger.info({
            req: {
                id: request.id,
                method: request.method,
                url: request.url,
            },
        }, 'Incoming request');
    });

    fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
        const latency = Date.now() - ((request as any).startTime || Date.now());

        logger.info({
            req: {
                id: request.id,
                method: request.method,
                url: request.url,
            },
            res: {
                statusCode: reply.statusCode,
                latency_ms: latency,
            },
        }, 'Request completed');
    });
}

export default fastifyPlugin(requestLoggerPlugin, {
    name: 'request-logger',
});
