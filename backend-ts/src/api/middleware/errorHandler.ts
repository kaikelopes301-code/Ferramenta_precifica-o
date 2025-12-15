/**
 * Global Error Handler
 * Handles all errors with proper status codes and logging
 */

import type { FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import { logger } from '../../infra/logging.js';

export async function errorHandler(
    error: FastifyError,
    request: FastifyRequest,
    reply: FastifyReply
): Promise<void> {
    // Handle Zod validation errors
    if (error instanceof ZodError) {
        logger.warn({
            req_id: request.id,
            errors: error.issues,
        }, 'Validation error');

        return reply.status(400).send({
            error: {
                code: 'VALIDATION_ERROR',
                message: 'Invalid request data',
                details: error.issues.map((e) => ({
                    path: e.path.join('.'),
                    message: e.message,
                })),
            },
            request_id: request.id,
        });
    }

    // Determine status code
    const statusCode = error.statusCode || 500;

    // Log based on severity
    if (statusCode >= 500) {
        logger.error({
            req_id: request.id,
            error: {
                name: error.name,
                message: error.message,
                stack: error.stack,
            },
        }, 'Internal server error');
    } else {
        logger.warn({
            req_id: request.id,
            error: {
                name: error.name,
                message: error.message,
            },
        }, 'Client error');
    }

    // Send error response
    return reply.status(statusCode).send({
        error: {
            code: error.name || 'ERROR',
            message: error.message || 'An error occurred',
        },
        request_id: request.id,
    });
}
