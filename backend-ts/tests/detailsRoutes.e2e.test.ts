/**
 * Details Routes E2E
 *
 * Anti-regression: fails if /api/detalhes is not wired to the corpus repository.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { initializeApp } from '../src/api/index.js'
import type { FastifyInstance } from 'fastify'

describe('Details Routes E2E', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = await initializeApp()
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  it('GET / and HEAD / should return 200', async () => {
    const [getRes, headRes] = await Promise.all([
      app.inject({ method: 'GET', url: '/' }),
      app.inject({ method: 'HEAD', url: '/' }),
    ])

    expect(getRes.statusCode).toBe(200)
    expect(headRes.statusCode).toBe(200)
  })

  it('GET /api/detalhes/:grupo should return 200 for a known group', async () => {
    // Discover a valid grupo through the search endpoint.
    const searchRes = await app.inject({
      method: 'POST',
      url: '/api/search',
      payload: { query: 'mop', top_k: 1 },
    })

    expect(searchRes.statusCode).toBe(200)
    const searchBody = searchRes.json() as any
    const grupo = searchBody?.resultados?.[0]?.grupo

    expect(typeof grupo).toBe('string')
    expect(grupo.length).toBeGreaterThan(0)

    const detailsRes = await app.inject({
      method: 'GET',
      url: `/api/detalhes/${encodeURIComponent(grupo)}`,
    })

    // If corpus injection regresses, details will respond 503 (CORPUS_NOT_READY).
    expect(detailsRes.statusCode).toBe(200)

    const detailsBody = detailsRes.json() as any
    expect(detailsBody.grupo).toBe(grupo)
    expect(Array.isArray(detailsBody.items)).toBe(true)
    expect(detailsBody.total).toBeGreaterThan(0)
  })
})
