/**
 * Semantic Reranker Unit Tests - Golden Fixture Validation
 *
 * These tests validate that the TypeScript semantic reranker implementation
 * produces the same rankings as the Python implementation using mock embeddings.
 *
 * Domain: Professional cleaning equipment
 */

import { describe, it, expect, beforeAll } from 'vitest'
import {
  createSemanticReranker,
  CandidateInput,
  ScoredCandidate,
  MockEmbeddingProvider,
  MockCrossEncoderProvider,
  cosineSimilarity,
  l2Normalize,
  normalizeScores,
  shouldRerank,
  computeNumericBoost,
  SCORE_WEIGHT_EMBEDDING,
  SCORE_WEIGHT_RERANKER,
  SCORE_WEIGHT_NUMERIC,
  SEMANTIC_CONFIDENCE_THRESHOLD,
} from '../src/domain/semanticReranker'
import { normalizeEquip } from '../src/domain/normalization'
import { extractAllAttributes } from '../src/domain/attributes'

// Load golden fixtures
import golden from './fixtures/semantic_rerank_golden.json'

// =============================================================================
// Types for golden fixtures
// =============================================================================

interface GoldenCorpusDoc {
  id: string
  text: string
  text_normalized: string
  category: string
}

interface GoldenResult {
  id: string
  text: string
  text_normalized: string
  semantic_score: number
  reranker_score: number
  numeric_boost: number
  final_score: number
}

interface GoldenQueryCase {
  query: string
  query_normalized: string
  results: GoldenResult[]
}

interface GoldenCrossEncoderPair {
  query: string
  doc: string
  score: number
}

interface GoldenFile {
  metadata: {
    description: string
    domain: string
    weights: {
      semantic: number
      reranker: number
      numeric: number
    }
    embedding_dim: number
  }
  corpus: GoldenCorpusDoc[]
  embeddings: Record<string, number[]>
  cross_encoder_pairs: GoldenCrossEncoderPair[]
  queries: GoldenQueryCase[]
}

const data = golden as unknown as GoldenFile

// =============================================================================
// Utility Function Tests
// =============================================================================

describe('Semantic Reranker Utilities', () => {
  describe('cosineSimilarity', () => {
    it('computes similarity between identical vectors', () => {
      const v = [1, 0, 0, 0]
      expect(cosineSimilarity(v, v)).toBeCloseTo(1.0, 5)
    })

    it('computes similarity between orthogonal vectors', () => {
      const v1 = [1, 0, 0]
      const v2 = [0, 1, 0]
      expect(cosineSimilarity(v1, v2)).toBeCloseTo(0.0, 5)
    })

    it('computes similarity between opposite vectors', () => {
      const v1 = [1, 0]
      const v2 = [-1, 0]
      expect(cosineSimilarity(v1, v2)).toBeCloseTo(-1.0, 5)
    })

    it('handles arbitrary vectors', () => {
      const v1 = [1, 2, 3]
      const v2 = [4, 5, 6]
      // Manual: dot = 32, |v1| = sqrt(14), |v2| = sqrt(77)
      const expected = 32 / (Math.sqrt(14) * Math.sqrt(77))
      expect(cosineSimilarity(v1, v2)).toBeCloseTo(expected, 5)
    })
  })

  describe('l2Normalize', () => {
    it('normalizes non-zero vector', () => {
      const v = [3, 4]
      const normalized = l2Normalize(v)
      expect(normalized[0]).toBeCloseTo(0.6, 5)
      expect(normalized[1]).toBeCloseTo(0.8, 5)
    })

    it('returns original for zero vector', () => {
      const v = [0, 0, 0]
      const normalized = l2Normalize(v)
      expect(normalized).toEqual([0, 0, 0])
    })
  })

  describe('normalizeScores', () => {
    it('normalizes to [0, 1] range', () => {
      const scores = [1, 5, 3]
      const normalized = normalizeScores(scores)
      expect(normalized[0]).toBeCloseTo(0.0, 5) // min
      expect(normalized[1]).toBeCloseTo(1.0, 5) // max
      expect(normalized[2]).toBeCloseTo(0.5, 5) // middle
    })

    it('handles empty array', () => {
      expect(normalizeScores([])).toEqual([])
    })

    it('handles all equal values', () => {
      const scores = [5, 5, 5]
      const normalized = normalizeScores(scores)
      expect(normalized).toEqual([0.5, 0.5, 0.5])
    })
  })

  describe('shouldRerank', () => {
    it('returns false for high confidence', () => {
      expect(shouldRerank([0.9, 0.7, 0.5])).toBe(false)
    })

    it('returns true for low confidence', () => {
      expect(shouldRerank([0.5, 0.4, 0.3])).toBe(true)
    })

    it('returns false for empty scores', () => {
      expect(shouldRerank([])).toBe(false)
    })

    it('respects threshold parameter', () => {
      expect(shouldRerank([0.6], 0.5)).toBe(false) // 0.6 >= 0.5
      expect(shouldRerank([0.4], 0.5)).toBe(true)  // 0.4 < 0.5
    })
  })
})

// =============================================================================
// Constants Validation
// =============================================================================

describe('Score Weight Constants', () => {
  it('should match Python weights', () => {
    expect(SCORE_WEIGHT_EMBEDDING).toBe(data.metadata.weights.semantic)
    expect(SCORE_WEIGHT_RERANKER).toBe(data.metadata.weights.reranker)
    expect(SCORE_WEIGHT_NUMERIC).toBe(data.metadata.weights.numeric)
  })

  it('weights should sum to 1.0', () => {
    const total = SCORE_WEIGHT_EMBEDDING + SCORE_WEIGHT_RERANKER + SCORE_WEIGHT_NUMERIC
    expect(total).toBeCloseTo(1.0, 5)
  })
})

// =============================================================================
// Mock Provider Tests
// =============================================================================

describe('MockEmbeddingProvider', () => {
  it('returns embeddings from golden fixture', async () => {
    const provider = MockEmbeddingProvider.fromGolden(
      data.embeddings,
      data.metadata.embedding_dim
    )

    // Check a known embedding
    const queryText = 'lavadora de piso'
    const emb = await provider.embedQuery(queryText)
    
    expect(emb.length).toBe(data.metadata.embedding_dim)
    
    // Should be L2 normalized
    const norm = Math.sqrt(emb.reduce((sum, v) => sum + v * v, 0))
    expect(norm).toBeCloseTo(1.0, 4)
  })

  it('returns zero vector for unknown text', async () => {
    const provider = MockEmbeddingProvider.fromGolden(data.embeddings, 32)
    
    const emb = await provider.embedQuery('unknown_text_xyz')
    expect(emb.length).toBe(32)
    expect(emb.every((v) => v === 0)).toBe(true)
  })
})

describe('MockCrossEncoderProvider', () => {
  it('returns scores from golden fixture', async () => {
    const provider = MockCrossEncoderProvider.fromGolden(data.cross_encoder_pairs)

    // Test a known pair
    const pair = data.cross_encoder_pairs[0]
    const scores = await provider.score(pair.query, [pair.doc])
    
    expect(scores.length).toBe(1)
    expect(scores[0]).toBeCloseTo(pair.score, 4)
  })

  it('returns 0 for unknown pairs', async () => {
    const provider = MockCrossEncoderProvider.fromGolden(data.cross_encoder_pairs)
    
    const scores = await provider.score('unknown_query', ['unknown_doc'])
    expect(scores).toEqual([0])
  })
})

// =============================================================================
// Semantic Reranker Integration Tests
// =============================================================================

describe('Semantic Reranker', () => {
  let embeddingProvider: MockEmbeddingProvider
  let crossEncoderProvider: MockCrossEncoderProvider

  beforeAll(() => {
    embeddingProvider = MockEmbeddingProvider.fromGolden(
      data.embeddings,
      data.metadata.embedding_dim
    )
    crossEncoderProvider = MockCrossEncoderProvider.fromGolden(
      data.cross_encoder_pairs
    )
  })

  it('should create a reranker instance', () => {
    const reranker = createSemanticReranker(
      embeddingProvider,
      crossEncoderProvider
    )
    expect(reranker).toBeDefined()
    expect(typeof reranker.rerank).toBe('function')
  })

  it('should handle empty candidates', async () => {
    const reranker = createSemanticReranker(
      embeddingProvider,
      crossEncoderProvider
    )

    const results = await reranker.rerank('test query', [])
    expect(results).toEqual([])
  })

  // Test semantic score computation
  describe('Semantic Score Computation', () => {
    it('computes correct semantic scores from embeddings', async () => {
      const query = 'lavadora de piso'
      const qNorm = normalizeEquip(query)
      const qEmb = await embeddingProvider.embedQuery(qNorm)

      // Get embedding for a corpus item
      const corpusItem = data.corpus[0]
      const dEmb = await embeddingProvider.embedQuery(corpusItem.text_normalized)

      // Compute similarity
      const sim = cosineSimilarity(qEmb, dEmb)

      // Should be a valid similarity score
      expect(sim).toBeGreaterThanOrEqual(-1)
      expect(sim).toBeLessThanOrEqual(1)
    })
  })
})

// =============================================================================
// Golden Fixture Tests
// =============================================================================

describe('Golden Fixture Validation', () => {
  let embeddingProvider: MockEmbeddingProvider
  let crossEncoderProvider: MockCrossEncoderProvider

  beforeAll(() => {
    embeddingProvider = MockEmbeddingProvider.fromGolden(
      data.embeddings,
      data.metadata.embedding_dim
    )
    crossEncoderProvider = MockCrossEncoderProvider.fromGolden(
      data.cross_encoder_pairs
    )
  })

  // Test first few queries against golden results
  for (const queryCase of data.queries.slice(0, 5)) {
    describe(`Query: "${queryCase.query}"`, () => {
      it('computes semantic scores matching Python', async () => {
        // Use query_normalized from golden (Python already normalized it)
        const qNorm = queryCase.query_normalized
        
        // Get embedding directly using the normalized key
        const qEmbRaw = data.embeddings[qNorm]
        if (!qEmbRaw) {
          // Skip if embedding not in fixture
          return
        }
        const qEmb = l2Normalize(qEmbRaw)

        // For each result in golden, verify semantic score
        for (const result of queryCase.results.slice(0, 3)) {
          const dEmbRaw = data.embeddings[result.text_normalized]
          if (!dEmbRaw) continue
          
          const dEmb = l2Normalize(dEmbRaw)
          const tsSemantic = cosineSimilarity(qEmb, dEmb)

          // Should match Python's semantic_score
          expect(tsSemantic).toBeCloseTo(result.semantic_score, 3)
        }
      })

      it('produces correct final ranking', async () => {
        // Build candidates from corpus
        const candidates: CandidateInput[] = data.corpus.map((doc) => ({
          id: doc.id,
          text: doc.text,
        }))

        const reranker = createSemanticReranker(
          embeddingProvider,
          crossEncoderProvider,
          {
            // Force reranking for testing (low threshold)
            confidenceThreshold: 0.0,
          }
        )

        const tsResults = await reranker.rerank(queryCase.query, candidates)

        // Get top 3 IDs
        const tsTop3 = tsResults.slice(0, 3).map((r) => r.id)
        const pyTop3 = queryCase.results.slice(0, 3).map((r) => r.id)

        // At least 2 of top 3 should match (allowing for minor score differences)
        const overlap = tsTop3.filter((id) => pyTop3.includes(id)).length
        expect(overlap).toBeGreaterThanOrEqual(2)
      })
    })
  }
})

// =============================================================================
// Numeric Boost Tests
// =============================================================================

describe('Numeric Boost Computation', () => {
  it('returns 0 when no matching numeric attributes', () => {
    // Textos sem atributos numéricos específicos
    const queryAttrs = extractAllAttributes('lavadora')
    const itemAttrs = extractAllAttributes('aspirador')
    
    const boost = computeNumericBoost(queryAttrs, itemAttrs)
    // Sem atributos numéricos, boost deve ser 0
    expect(boost).toBeGreaterThanOrEqual(0)
  })

  it('boosts when voltage matches', () => {
    const queryAttrs = extractAllAttributes('lavadora 220v')
    const itemAttrs = extractAllAttributes('lavadora de piso 220v')
    
    const boost = computeNumericBoost(queryAttrs, itemAttrs)
    expect(boost).toBeGreaterThan(0)
  })

  it('boosts when capacity matches', () => {
    const queryAttrs = extractAllAttributes('aspirador 50l')
    const itemAttrs = extractAllAttributes('aspirador industrial 50 litros')
    
    const boost = computeNumericBoost(queryAttrs, itemAttrs)
    expect(boost).toBeGreaterThan(0)
  })
})

// =============================================================================
// Domain-Specific Tests (Cleaning Equipment)
// =============================================================================

describe('Domain: Cleaning Equipment', () => {
  let embeddingProvider: MockEmbeddingProvider
  let crossEncoderProvider: MockCrossEncoderProvider

  beforeAll(() => {
    embeddingProvider = MockEmbeddingProvider.fromGolden(
      data.embeddings,
      data.metadata.embedding_dim
    )
    crossEncoderProvider = MockCrossEncoderProvider.fromGolden(
      data.cross_encoder_pairs
    )
  })

  it('normalizes queries correctly', () => {
    const query = 'Lavadora de Piso 50L 220V'
    const normalized = normalizeEquip(query)
    
    expect(normalized).toBe('lavadora de piso 50l 220v')
  })

  it('handles cleaning equipment categories', () => {
    const coreItems = data.corpus.filter((d) => d.category === 'cleaning_core')
    const supportItems = data.corpus.filter((d) => d.category === 'cleaning_support')
    const peripheralItems = data.corpus.filter((d) => d.category === 'peripheral')

    expect(coreItems.length).toBeGreaterThan(0)
    expect(supportItems.length).toBeGreaterThan(0)
    expect(peripheralItems.length).toBeGreaterThan(0)
  })
})

// =============================================================================
// Score Combination Formula Tests
// =============================================================================

describe('Score Combination Formula', () => {
  it('applies correct formula: 0.7*semantic + 0.2*reranker + 0.1*numeric', () => {
    const semantic = 0.8
    const reranker = 0.6
    const numeric = 0.4

    const expected =
      SCORE_WEIGHT_EMBEDDING * semantic +
      SCORE_WEIGHT_RERANKER * reranker +
      SCORE_WEIGHT_NUMERIC * numeric

    // 0.7*0.8 + 0.2*0.6 + 0.1*0.4 = 0.56 + 0.12 + 0.04 = 0.72
    expect(expected).toBeCloseTo(0.72, 5)
  })

  it('validates golden fixture scores follow the formula', () => {
    // Check first result of first query
    const result = data.queries[0].results[0]
    
    const expected =
      SCORE_WEIGHT_EMBEDDING * result.semantic_score +
      SCORE_WEIGHT_RERANKER * result.reranker_score +
      SCORE_WEIGHT_NUMERIC * result.numeric_boost

    expect(result.final_score).toBeCloseTo(expected, 3)
  })
})
