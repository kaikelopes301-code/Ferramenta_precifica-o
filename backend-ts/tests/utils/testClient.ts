/**
 * Test Client Helper
 *
 * Provides utilities for testing the Fastify application.
 */

import { buildApp } from '../../src/api/index.js'
import type { FastifyInstance } from 'fastify'

let app: FastifyInstance | null = null

/**
 * Get a test instance of the application
 */
export function getTestApp(): FastifyInstance {
  if (!app) {
    app = buildApp()
  }
  return app
}

/**
 * Close the test application
 */
export async function closeTestApp(): Promise<void> {
  if (app) {
    await app.close()
    app = null
  }
}
