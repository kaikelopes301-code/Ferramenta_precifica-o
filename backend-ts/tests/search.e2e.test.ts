/**
 * Search API E2E Tests
 *
 * Tests the TypeScript search API endpoints
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { initializeApp } from '../src/api/index.js'
import type { FastifyInstance } from 'fastify'

describe('Search API E2E', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = await initializeApp()
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  describe('Health and Status', () => {
    it('GET /api/health - should return healthy status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/health',
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.status).toBe('healthy')
    })

    it('GET /api/data/status - should return dataset information', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/data/status',
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.dataset).toBeDefined()
      expect(body.dataset.total_products).toBeGreaterThan(0)
    })
  })

  describe('Search Functionality', () => {
    it('POST /api/search - should return search results', async () => {
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
      expect(body.resultados).toBeDefined()
      expect(Array.isArray(body.resultados)).toBe(true)
      expect(body.total).toBeGreaterThanOrEqual(0)
    })

    it('POST /api/search - should handle cleaning product queries', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/search',
        payload: {
          query: 'balde',
          top_k: 3,
        },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.resultados.length).toBeGreaterThan(0)
      expect(body.resultados[0]).toHaveProperty('grupo')
      expect(body.resultados[0]).toHaveProperty('descricao')
      expect(body.resultados[0]).toHaveProperty('score')
    })

    it('POST /api/search - should treat accents equivalently (móp == mop)', async () => {
      const [r1, r2] = await Promise.all([
        app.inject({
          method: 'POST',
          url: '/api/search',
          payload: { query: 'mop', top_k: 10 },
        }),
        app.inject({
          method: 'POST',
          url: '/api/search',
          payload: { query: 'móp', top_k: 10 },
        }),
      ])

      expect(r1.statusCode).toBe(200)
      expect(r2.statusCode).toBe(200)

      const b1 = r1.json() as any
      const b2 = r2.json() as any

      const g1 = (b1.resultados ?? []).map((x: any) => x.grupo)
      const g2 = (b2.resultados ?? []).map((x: any) => x.grupo)

      expect(g1).toEqual(g2)
    })

    it('POST /api/search - navigation intent should diversify category query (vassoura)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/search',
        payload: {
          query: 'vassoura',
          top_k: 5,
        },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json() as any

      expect(Array.isArray(body.resultados)).toBe(true)
      expect(body.resultados.length).toBe(5)

      const normalize = (s: string) =>
        (s || '')
          .normalize('NFD')
          // eslint-disable-next-line no-control-regex
          .replace(/\p{Diacritic}/gu, '')
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()

      const stopwords = new Set(['de', 'da', 'do', 'das', 'dos', 'para', 'pra', 'com', 'sem', 'e'])

      const subtypeKey = (desc: string) => {
        const tokens = normalize(desc).split(' ').filter(Boolean)
        const filtered = tokens.filter((t) => t !== 'vassoura' && !stopwords.has(t))
        return (filtered.join(' ').trim() || normalize(desc))
      }

      const descs: string[] = body.resultados.map((r: any) => String(r.descricao ?? r.grupo ?? ''))
      const vassouraHits = descs.filter((d) => normalize(d).includes('vassour'))
      expect(vassouraHits.length).toBeGreaterThanOrEqual(3)

      const uniqueSubtypes = new Set(descs.map(subtypeKey))
      expect(uniqueSubtypes.size).toBeGreaterThanOrEqual(3)
    })

    it('POST /api/search - should return business numeric fields (vassoura)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/search',
        payload: {
          query: 'vassoura',
          top_k: 5,
        },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json() as any

      expect(Array.isArray(body.resultados)).toBe(true)
      expect(body.resultados.length).toBe(5)

      let finiteValorCount = 0

      for (const r of body.resultados) {
        // Campos devem existir (nunca undefined)
        expect(r.valor_unitario).not.toBeUndefined()
        expect(r.vida_util_meses).not.toBeUndefined()
        expect(r.manutencao_percent).not.toBeUndefined()

        // E devem ser number|null (nunca NaN)
        if (r.valor_unitario !== null) {
          expect(typeof r.valor_unitario).toBe('number')
          expect(Number.isFinite(r.valor_unitario)).toBe(true)
          finiteValorCount++
        }

        if (r.vida_util_meses !== null) {
          expect(typeof r.vida_util_meses).toBe('number')
          expect(Number.isFinite(r.vida_util_meses)).toBe(true)
        }

        if (r.manutencao_percent !== null) {
          expect(typeof r.manutencao_percent).toBe('number')
          expect(Number.isFinite(r.manutencao_percent)).toBe(true)
        }
      }

      // Pelo menos 4/5 com valor unitário válido
      expect(finiteValorCount).toBeGreaterThanOrEqual(4)
    })

    it('POST /api/search - specific query should not behave like navigation (vassoura piaçava)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/search',
        payload: {
          query: 'vassoura piaçava',
          top_k: 5,
        },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json() as any
      expect(Array.isArray(body.resultados)).toBe(true)
      expect(body.resultados.length).toBeGreaterThan(0)

      const normalize = (s: string) =>
        (s || '')
          .normalize('NFD')
          // eslint-disable-next-line no-control-regex
          .replace(/\p{Diacritic}/gu, '')
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()

      const top1Desc = String(body.resultados[0]?.descricao ?? '')
      expect(normalize(top1Desc)).toContain('vassoura')
      expect(normalize(top1Desc)).toContain('piacava')
    })
  })
})
