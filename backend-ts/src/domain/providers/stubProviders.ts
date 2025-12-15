/**
 * Stub Providers for TS Hybrid Engine
 *
 * These are placeholder implementations for EmbeddingProvider and CrossEncoderProvider.
 * They return constant values and are meant for testing/development.
 *
 * In production, these would be replaced with real providers that:
 * - Connect to embedding APIs (OpenAI, Hugging Face, etc.)
 * - Use local models via ONNX or similar
 *
 * For Phase 13 (dataset integration), these stubs allow the engine to run
 * without external dependencies.
 */

import type { EmbeddingProvider, CrossEncoderProvider } from '../semanticReranker.js'
import { logger } from '../../infra/logging.js'

// =============================================================================
// Stub Embedding Provider
// =============================================================================

/**
 * Stub embedding provider that returns hash-based embeddings
 *
 * Uses simple text hashing to generate deterministic vectors.
 * This ensures same text → same embedding (for testing consistency).
 */
export class StubEmbeddingProvider implements EmbeddingProvider {
  readonly dimension: number
  private readonly cache = new Map<string, number[]>()

  constructor(dimension: number = 384) {
    this.dimension = dimension
    logger.info('[StubEmbeddingProvider] Initialized', { dimension })
  }

  async embedQuery(text: string): Promise<number[]> {
    return this.getOrCreateEmbedding(text)
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    return texts.map((text) => this.getOrCreateEmbedding(text))
  }

  private getOrCreateEmbedding(text: string): number[] {
    const cached = this.cache.get(text)
    if (cached) return cached

    // Simple hash-based deterministic embedding
    const embedding = this.hashToVector(text)
    this.cache.set(text, embedding)
    return embedding
  }

  private hashToVector(text: string): number[] {
    const vector: number[] = []

    // Simple hashing algorithm for reproducible results
    let hash = 5381
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) + hash) ^ text.charCodeAt(i)
    }

    // Generate dimension values from hash
    const seed = Math.abs(hash)
    for (let i = 0; i < this.dimension; i++) {
      // Use linear congruential generator for pseudo-random values
      const x = Math.sin(seed * (i + 1)) * 10000
      vector.push(x - Math.floor(x) - 0.5) // Normalize to -0.5 to 0.5
    }

    // Normalize to unit vector
    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0))
    if (norm > 0) {
      return vector.map(v => v / norm)
    }

    return vector
  }
}

// =============================================================================
// Stub Cross-Encoder Provider
// =============================================================================

/**
 * Stub cross-encoder provider that returns scores based on word overlap
 *
 * Provides scores based on simple text overlap metrics.
 * Real cross-encoders would use transformers to score query-document pairs.
 */
export class StubCrossEncoderProvider implements CrossEncoderProvider {
  constructor() {
    logger.info('[StubCrossEncoderProvider] Initialized')
  }

  async score(query: string, documents: string[]): Promise<number[]> {
    return documents.map((doc) => this.computeOverlapScore(query, doc))
  }

  private computeOverlapScore(query: string, text: string): number {
    // Simple word overlap scoring
    const queryWords = new Set(query.toLowerCase().split(/\s+/).filter(Boolean))
    const textWords = text.toLowerCase().split(/\s+/).filter(Boolean)

    if (queryWords.size === 0 || textWords.length === 0) return 0.0

    let matchCount = 0
    for (const word of textWords) {
      if (queryWords.has(word)) {
        matchCount++
      }
    }

    // Normalize by query size
    const recall = matchCount / queryWords.size
    const precision = textWords.length > 0 ? matchCount / textWords.length : 0

    // F1-like score
    if (recall + precision === 0) return 0.0
    return (2 * recall * precision) / (recall + precision)
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a stub embedding provider
 */
export function createStubEmbeddingProvider(dimension = 384): StubEmbeddingProvider {
  return new StubEmbeddingProvider(dimension)
}

/**
 * Create a stub cross-encoder provider
 */
export function createStubCrossEncoderProvider(): StubCrossEncoderProvider {
  return new StubCrossEncoderProvider()
}
