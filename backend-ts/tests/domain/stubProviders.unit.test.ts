/**
 * Stub Providers Unit Tests
 *
 * Tests the stub embedding and cross-encoder providers.
 */

import { describe, it, expect } from 'vitest'
import {
  StubEmbeddingProvider,
  StubCrossEncoderProvider,
  createStubEmbeddingProvider,
  createStubCrossEncoderProvider,
} from '../../src/domain/providers/stubProviders.js'

describe('StubEmbeddingProvider', () => {
  describe('constructor', () => {
    it('should create with default dimension', () => {
      const provider = new StubEmbeddingProvider()
      expect(provider.dimension).toBe(384)
    })

    it('should create with custom dimension', () => {
      const provider = new StubEmbeddingProvider(128)
      expect(provider.dimension).toBe(128)
    })
  })

  describe('embedQuery', () => {
    it('should return embedding with correct dimension', async () => {
      const provider = new StubEmbeddingProvider(64)
      const embedding = await provider.embedQuery('test query')

      expect(embedding).toHaveLength(64)
      expect(embedding.every((v) => typeof v === 'number')).toBe(true)
    })

    it('should return normalized embedding (unit vector)', async () => {
      const provider = new StubEmbeddingProvider(128)
      const embedding = await provider.embedQuery('lavadora de piso')

      const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0))
      expect(norm).toBeCloseTo(1.0, 5)
    })

    it('should return same embedding for same text (deterministic)', async () => {
      const provider = new StubEmbeddingProvider()
      const text = 'aspirador industrial 80 litros'

      const embedding1 = await provider.embedQuery(text)
      const embedding2 = await provider.embedQuery(text)

      expect(embedding1).toEqual(embedding2)
    })

    it('should return different embeddings for different texts', async () => {
      const provider = new StubEmbeddingProvider()

      const embedding1 = await provider.embedQuery('lavadora')
      const embedding2 = await provider.embedQuery('aspirador')

      expect(embedding1).not.toEqual(embedding2)
    })
  })

  describe('embedDocuments', () => {
    it('should embed multiple documents', async () => {
      const provider = new StubEmbeddingProvider(32)
      const texts = ['doc1', 'doc2', 'doc3']

      const embeddings = await provider.embedDocuments(texts)

      expect(embeddings).toHaveLength(3)
      expect(embeddings.every((e) => e.length === 32)).toBe(true)
    })

    it('should return same embeddings as embedQuery for same texts', async () => {
      const provider = new StubEmbeddingProvider()
      const text = 'lavadora karcher'

      const queryEmbed = await provider.embedQuery(text)
      const docEmbeds = await provider.embedDocuments([text])

      expect(docEmbeds[0]).toEqual(queryEmbed)
    })
  })

  describe('factory function', () => {
    it('should create provider with default dimension', () => {
      const provider = createStubEmbeddingProvider()
      expect(provider.dimension).toBe(384)
    })

    it('should create provider with custom dimension', () => {
      const provider = createStubEmbeddingProvider(256)
      expect(provider.dimension).toBe(256)
    })
  })
})

describe('StubCrossEncoderProvider', () => {
  describe('score', () => {
    it('should return scores for all documents', async () => {
      const provider = new StubCrossEncoderProvider()
      const query = 'lavadora de piso'
      const docs = ['lavadora industrial', 'aspirador', 'enceradeira']

      const scores = await provider.score(query, docs)

      expect(scores).toHaveLength(3)
      expect(scores.every((s) => typeof s === 'number')).toBe(true)
    })

    it('should give higher score to more similar document', async () => {
      const provider = new StubCrossEncoderProvider()
      const query = 'lavadora de piso profissional'

      const scores = await provider.score(query, [
        'lavadora piso industrial profissional',
        'aspirador de pó industrial',
      ])

      expect(scores[0]).toBeGreaterThan(scores[1])
    })

    it('should return 0 for completely unrelated document', async () => {
      const provider = new StubCrossEncoderProvider()
      const query = 'lavadora'

      const scores = await provider.score(query, [
        'xyz abc 123', // No overlap
      ])

      expect(scores[0]).toBe(0)
    })

    it('should return same score for same content', async () => {
      const provider = new StubCrossEncoderProvider()
      const query = 'lavadora karcher'

      const scores1 = await provider.score(query, ['lavadora karcher industrial'])
      const scores2 = await provider.score(query, ['lavadora karcher industrial'])

      expect(scores1[0]).toBe(scores2[0])
    })

    it('should handle empty query', async () => {
      const provider = new StubCrossEncoderProvider()

      const scores = await provider.score('', ['some document'])

      expect(scores[0]).toBe(0)
    })

    it('should handle empty document', async () => {
      const provider = new StubCrossEncoderProvider()

      const scores = await provider.score('some query', [''])

      expect(scores[0]).toBe(0)
    })
  })

  describe('factory function', () => {
    it('should create provider', () => {
      const provider = createStubCrossEncoderProvider()
      expect(provider).toBeInstanceOf(StubCrossEncoderProvider)
    })
  })
})
