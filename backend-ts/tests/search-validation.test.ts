/**
 * Search Route Validation Tests
 * 
 * Tests input validation for search endpoints
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { initializeApp } from '../src/api/index.js'
import type { FastifyInstance } from 'fastify'

describe('Search Route Validation', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = await initializeApp()
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  describe('POST /api/search - Input Validation', () => {
    it('should reject requests without query parameter', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/search',
        payload: {
          // query missing
          top_k: 5,
        },
      })

      expect(response.statusCode).toBe(400)
    })

    it('should reject empty query string', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/search',
        payload: {
          query: '',
          top_k: 5,
        },
      })

      expect(response.statusCode).toBe(400)
    })

    it('should accept valid query', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/search',
        payload: {
          query: 'mop',
          top_k: 5,
        },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body).toHaveProperty('resultados')
      expect(Array.isArray(body.resultados)).toBe(true)
    })

    it('should use default top_k when omitted', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/search',
        payload: {
          query: 'balde',
        },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.resultados.length).toBeLessThanOrEqual(10) // Default is 10
    })

    it('should clamp top_k to maximum allowed', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/search',
        payload: {
          query: 'carrinho',
          top_k: 9999, // Exceeds limit
        },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      // Should be clamped to maxTopK (50 for default profile, 30 for free_tier)
      expect(body.resultados.length).toBeLessThanOrEqual(50)
    })
  })
})
