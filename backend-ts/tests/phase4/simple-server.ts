/**
 * Phase 4 Simple Server - Data Management
 * Port 3003
 */

import 'reflect-metadata';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { DataService } from '../../src/domain/services/DataService.js';

const PORT = 3003;

async function start() {
  console.log('🚀 Starting Phase 4 Server - Data Management...\n');

  const app = Fastify({ logger: false });
  await app.register(cors, { origin: true });

  const service = new DataService();

  // Health
  app.get('/health', async () => ({ status: 'ok', phase: 4 }));

  // API
  app.get('/api/data/status', async (req, reply) => {
    try {
      return await service.getDatasetStatus();
    } catch (e) {
      return reply.code(500).send({ error: e.message });
    }
  });

  await app.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`✅ Server listening on port ${PORT}`);
  console.log(`📡 GET http://localhost:${PORT}/api/data/status`);
}

start().catch(e => {
  console.error(e);
  process.exit(1);
});
