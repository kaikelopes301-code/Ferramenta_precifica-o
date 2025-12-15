/**
 * Data Routes - Dataset Management
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DataService } from '../../domain/services/DataService.js';

export async function dataRoutes(app: FastifyInstance) {
  const service = new DataService();

  /**
   * GET /api/data/status
   */
  app.get('/api/data/status', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const status = await service.getDatasetStatus();
      return reply.code(200).send(status);
    } catch (error) {
      console.error('[DataRoutes] Error:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}
