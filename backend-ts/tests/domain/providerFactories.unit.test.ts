/**
 * Provider Factory Unit Tests
 *
 * Tests the embedding and cross-encoder provider factories.
 * Ensures correct provider selection based on configuration.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createEmbeddingProvider } from '../../src/domain/providers/embeddingProviderFactory.js'
import { createCrossEncoderProvider, NoOpCrossEncoderProvider } from '../../src/domain/providers/crossEncoderProviderFactory.js'
import { StubEmbeddingProvider, StubCrossEncoderProvider } from '../../src/domain/providers/stubProviders.js'
import { HuggingFaceEmbeddingProvider } from '../../src/domain/providers/huggingFaceEmbeddingProvider.js'
import { OpenAIEmbeddingProvider } from '../../src/domain/providers/openAIEmbeddingProvider.js'
import { HuggingFaceCrossEncoderProvider } from '../../src/domain/providers/huggingFaceCrossEncoderProvider.js'

describe('createEmbeddingProvider', () => {
  describe('with mode=mock', () => {
    it('should create StubEmbeddingProvider', () => {
      const provider = createEmbeddingProvider('mock')
      expect(provider).toBeInstanceOf(StubEmbeddingProvider)
    })

    it('should have embedQuery and embedDocuments methods', async () => {
      const provider = createEmbeddingProvider('mock')

      const queryEmbedding = await provider.embedQuery('test')
      expect(queryEmbedding).toBeInstanceOf(Array)
      expect(queryEmbedding.length).toBeGreaterThan(0)

      const docEmbeddings = await provider.embedDocuments(['doc1', 'doc2'])
      expect(docEmbeddings).toHaveLength(2)
    })
  })

  describe('with mode=hf', () => {
    it('should throw if HF_API_KEY is not set', () => {
      // HF provider requires API key
      expect(() => createEmbeddingProvider('hf')).toThrow(/API key/)
    })
  })

  describe('with mode=openai', () => {
    it('should throw if OPENAI_API_KEY is not set', () => {
      // OpenAI provider requires API key
      expect(() => createEmbeddingProvider('openai')).toThrow(/API key/)
    })
  })

  describe('with mode=none', () => {
    it('should throw error', () => {
      expect(() => createEmbeddingProvider('none')).toThrow(/not supported/)
    })
  })
})

describe('createCrossEncoderProvider', () => {
  describe('with mode=mock', () => {
    it('should create StubCrossEncoderProvider', () => {
      const provider = createCrossEncoderProvider('mock')
      expect(provider).toBeInstanceOf(StubCrossEncoderProvider)
    })

    it('should have score method', async () => {
      const provider = createCrossEncoderProvider('mock')

      const scores = await provider.score('query', ['doc1', 'doc2'])
      expect(scores).toHaveLength(2)
      expect(scores.every(s => typeof s === 'number')).toBe(true)
    })
  })

  describe('with mode=hf', () => {
    it('should throw if HF_API_KEY is not set', () => {
      expect(() => createCrossEncoderProvider('hf')).toThrow(/API key/)
    })
  })

  describe('with mode=none', () => {
    it('should create NoOpCrossEncoderProvider', () => {
      const provider = createCrossEncoderProvider('none')
      expect(provider).toBeInstanceOf(NoOpCrossEncoderProvider)
    })

    it('should return constant scores', async () => {
      const provider = createCrossEncoderProvider('none')
      const scores = await provider.score('query', ['doc1', 'doc2', 'doc3'])

      expect(scores).toHaveLength(3)
      expect(scores).toEqual([0.5, 0.5, 0.5])
    })
  })
})

describe('Provider interface compliance', () => {
  describe('EmbeddingProvider', () => {
    it('StubEmbeddingProvider should have dimension property', () => {
      const provider = new StubEmbeddingProvider()
      expect(provider.dimension).toBe(384)
    })

    it('should return embeddings of correct dimension', async () => {
      const dimension = 128
      const provider = new StubEmbeddingProvider(dimension)

      const embedding = await provider.embedQuery('test')
      expect(embedding).toHaveLength(dimension)
    })
  })

  describe('CrossEncoderProvider', () => {
    it('should handle empty document list', async () => {
      const provider = new StubCrossEncoderProvider()
      const scores = await provider.score('query', [])
      expect(scores).toEqual([])
    })
  })
})
