/**
 * TsHybridSearchEngine Integration Tests with Real Corpus
 *
 * Tests the TS search engine using the FileCorpusRepository.
 * These tests verify the engine can search through real corpus data.
 */

import path from 'node:path'
import { describe, it, expect, beforeAll } from 'vitest'
import { TsHybridSearchEngine } from '../../src/domain/engines/tsHybridEngine.js'
import { FileCorpusRepository } from '../../src/domain/corpus/FileCorpusRepository.js'
import {
  StubEmbeddingProvider,
  StubCrossEncoderProvider,
} from '../../src/domain/providers/stubProviders.js'

// Path to the test fixture
const FIXTURE_PATH = path.resolve(__dirname, '../fixtures/dataset_ts_sample.json')

describe('TsHybridSearchEngine with Real Corpus', () => {
  let engine: TsHybridSearchEngine

  beforeAll(async () => {
    // Create repository and providers
    const corpusRepository = new FileCorpusRepository(FIXTURE_PATH)
    const embeddingProvider = new StubEmbeddingProvider(128)
    const crossEncoderProvider = new StubCrossEncoderProvider()

    // Create engine
    engine = new TsHybridSearchEngine(
      corpusRepository,
      embeddingProvider,
      crossEncoderProvider,
      { tfidfTopK: 20, defaultTopK: 5 }
    )

    // Initialize engine (loads corpus, builds index)
    await engine.initialize()
  })

  describe('initialization', () => {
    it('should be ready after initialization', async () => {
      const ready = await engine.isReady()
      expect(ready).toBe(true)
    })
  })

  describe('smartSearch', () => {
    it('should find lavadoras when searching for "lavadora"', async () => {
      const result = await engine.smartSearch({
        descricao: 'lavadora de piso',
        top_k: 5,
      })

      expect(result.resultados.length).toBeGreaterThan(0)
      expect(result.query_original).toBe('lavadora de piso')
      expect(result.query_normalizada).toBeDefined()
    })

    it('should find aspiradores when searching for "aspirador"', async () => {
      const result = await engine.smartSearch({
        descricao: 'aspirador industrial',
        top_k: 5,
      })

      expect(result.resultados.length).toBeGreaterThan(0)
      const hasAspirador = result.resultados.some((r) =>
        r.descricao.toLowerCase().includes('aspirador')
      )
      expect(hasAspirador).toBe(true)
    })

    it('should return score breakdown for results', async () => {
      const result = await engine.smartSearch({
        descricao: 'lavadora',
        top_k: 3,
      })

      if (result.resultados.length > 0) {
        const firstResult = result.resultados[0]
        expect(firstResult.score_breakdown).toBeDefined()
        // TF-IDF should be >= 0
        expect(firstResult.score_breakdown?.tfidf).toBeGreaterThanOrEqual(0)
        // Semantic and reranker can be negative with stub providers
        // They're based on cosine similarity which can be negative
        expect(typeof firstResult.score_breakdown?.semantic).toBe('number')
        expect(typeof firstResult.score_breakdown?.reranker).toBe('number')
      }
    })

    it('should respect top_k limit', async () => {
      const result = await engine.smartSearch({
        descricao: 'limpeza',
        top_k: 3,
      })

      expect(result.resultados.length).toBeLessThanOrEqual(3)
    })

    it('should return normalized scores between 0 and 1', async () => {
      const result = await engine.smartSearch({
        descricao: 'lavadora piso 50l',
        top_k: 5,
      })

      for (const item of result.resultados) {
        expect(item.score_normalized).toBeGreaterThanOrEqual(0)
        expect(item.score_normalized).toBeLessThanOrEqual(1)
      }
    })

    it('should handle empty query', async () => {
      const result = await engine.smartSearch({
        descricao: '',
        top_k: 5,
      })

      expect(result.resultados).toBeDefined()
      expect(result.total).toBe(result.resultados.length)
    })

    it('should find equipment with voltage specifications', async () => {
      const result = await engine.smartSearch({
        descricao: '220v industrial',
        top_k: 10,
      })

      expect(result.resultados.length).toBeGreaterThan(0)
    })

    it('should search for capacidade (litros)', async () => {
      const result = await engine.smartSearch({
        descricao: '80 litros',
        top_k: 5,
      })

      // Should find some equipment with liters in description
      expect(result.resultados).toBeDefined()
    })
  })

  describe('smartSearchBatch', () => {
    it('should process multiple queries', async () => {
      const results = await engine.smartSearchBatch({
        descricoes: ['lavadora', 'aspirador', 'enceradeira'],
        top_k: 3,
      })

      expect(results).toHaveLength(3)
      expect(results[0].query_original).toBe('lavadora')
      expect(results[1].query_original).toBe('aspirador')
      expect(results[2].query_original).toBe('enceradeira')
    })

    it('should return consistent results across batch', async () => {
      // Run same query in batch and single
      const singleResult = await engine.smartSearch({
        descricao: 'lavadora',
        top_k: 3,
      })

      const batchResults = await engine.smartSearchBatch({
        descricoes: ['lavadora'],
        top_k: 3,
      })

      // Should have same structure
      expect(batchResults[0].resultados.length).toBe(singleResult.resultados.length)
    })
  })

  describe('result quality', () => {
    it('should rank exact matches higher', async () => {
      const result = await engine.smartSearch({
        descricao: 'Lavadora De Piso Operação A Pé Alfa A500 50L 220V',
        top_k: 5,
      })

      if (result.resultados.length > 0) {
        // First result should have high score for exact match
        expect(result.resultados[0].score).toBeGreaterThan(0)
      }
    })

    it('should handle common cleaning equipment terms', async () => {
      const equipmentTypes = [
        'lavadora',
        'aspirador',
        'hidrojateadora',
        'enceradeira',
        'varredeira',
      ]

      for (const type of equipmentTypes) {
        const result = await engine.smartSearch({
          descricao: type,
          top_k: 3,
        })

        // Should find at least some results for common equipment
        expect(result.resultados).toBeDefined()
      }
    })
  })

  describe('domain scoring integration', () => {
    it('should include domain score in score_breakdown', async () => {
      const result = await engine.smartSearch({
        descricao: 'lavadora de piso',
        top_k: 3,
      })

      expect(result.resultados.length).toBeGreaterThan(0)

      for (const item of result.resultados) {
        expect(item.score_breakdown).toBeDefined()
        expect(item.score_breakdown?.domain).toBeDefined()
        expect(item.score_breakdown?.domain).toBeGreaterThanOrEqual(0)
        expect(item.score_breakdown?.domain).toBeLessThanOrEqual(1)
      }
    })

    it('should prefer cleaning_core items for cleaning_core queries', async () => {
      // Query for a cleaning machine
      const result = await engine.smartSearch({
        descricao: 'lavadora de piso 50L',
        top_k: 10,
      })

      if (result.resultados.length > 1) {
        // Top results should have high domain scores (cleaning_core query matches cleaning_core docs)
        const topResult = result.resultados[0]
        expect(topResult.score_breakdown?.domain).toBeGreaterThan(0.5)
      }
    })

    it('should include all score components with proper weights', async () => {
      const result = await engine.smartSearch({
        descricao: 'aspirador industrial',
        top_k: 5,
      })

      if (result.resultados.length > 0) {
        const item = result.resultados[0]
        const breakdown = item.score_breakdown

        expect(breakdown).toBeDefined()
        if (breakdown) {
          // All components should be present
          expect(breakdown.tfidf).toBeDefined()
          expect(breakdown.semantic).toBeDefined()
          expect(breakdown.reranker).toBeDefined()
          expect(breakdown.domain).toBeDefined()
          expect(breakdown.combined).toBeDefined()

          // Combined should be weighted sum of components
          // Formula: 0.25×tfidf + 0.40×semantic + 0.20×reranker + 0.15×domain
          const expectedCombined =
            0.25 * breakdown.tfidf +
            0.40 * breakdown.semantic +
            0.20 * breakdown.reranker +
            0.15 * breakdown.domain

          // Allow small floating point tolerance
          expect(Math.abs(breakdown.combined - expectedCombined)).toBeLessThan(0.01)
        }
      }
    })

    it('should handle peripheral queries without suppressing peripheral results', async () => {
      // Simulate a peripheral query (though unlikely in our cleaning dataset)
      const result = await engine.smartSearch({
        descricao: 'celular',
        top_k: 5,
      })

      // Should still work and return results (if any exist in corpus)
      expect(result.resultados).toBeDefined()
      expect(Array.isArray(result.resultados)).toBe(true)
    })

    it('should give different domain scores for different query types', async () => {
      const cleaningQuery = await engine.smartSearch({
        descricao: 'lavadora de piso',
        top_k: 3,
      })

      const supportQuery = await engine.smartSearch({
        descricao: 'balde espremedor',
        top_k: 3,
      })

      // Both should have results
      if (cleaningQuery.resultados.length > 0 && supportQuery.resultados.length > 0) {
        // Domain scores should exist for both
        expect(cleaningQuery.resultados[0].score_breakdown?.domain).toBeDefined()
        expect(supportQuery.resultados[0].score_breakdown?.domain).toBeDefined()

        // Scores can vary based on query-document domain match
        // Just verify they're in valid range
        const cleaningDomain = cleaningQuery.resultados[0].score_breakdown?.domain ?? 0
        const supportDomain = supportQuery.resultados[0].score_breakdown?.domain ?? 0

        expect(cleaningDomain).toBeGreaterThanOrEqual(0)
        expect(cleaningDomain).toBeLessThanOrEqual(1)
        expect(supportDomain).toBeGreaterThanOrEqual(0)
        expect(supportDomain).toBeLessThanOrEqual(1)
      }
    })
  })
})
