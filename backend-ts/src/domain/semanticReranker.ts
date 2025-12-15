// ⚠️ CORE SEARCH COMPONENT – NÃO REMOVER ESTE ARQUIVO
// Este módulo faz parte do núcleo da engine de busca TypeScript.
// Responsável por: reranking semântico (embeddings + cross-encoder + numeric boost).
// Usado por: tsHybridEngine como componente principal de relevância semântica.

/**
 * Semantic Reranker Module for Cleaning Equipment Search
 *
 * This module implements semantic reranking logic that mirrors the Python implementation
 * in `backend/app/processamento/semantic_reranker.py` and `semantic_index.py`.
 *
 * Python Architecture Summary:
 * ============================
 *
 * 1. SemanticSearchIndex (semantic_index.py):
 *    - Uses SentenceTransformer embeddings (all-MiniLM-L6-v2)
 *    - Normalizes text via normalize_equip before encoding
 *    - L2-normalizes embeddings, uses cosine similarity (inner product)
 *    - Uses FAISS for fast ANN search
 *
 * 2. CrossEncoderReranker (semantic_reranker.py):
 *    - Uses cross-encoder/ms-marco-MiniLM-L-6-v2
 *    - Scores (query, document) pairs directly
 *    - Lazy reranking: skips if semantic confidence >= 0.75
 *    - Limits reranking to top 20 candidates
 *    - Normalizes scores to [0, 1] via min-max
 *
 * 3. Score Combination (search_pipeline.py):
 *    - final_score = 0.7 * semantic_score + 0.2 * reranker_score + 0.1 * numeric_boost
 *
 * Domain: Professional cleaning equipment (NOT generic industrial/motor catalog)
 */

import { normalizeEquip } from './normalization.js'
import { extractAllAttributes, ExtractedAttributes } from './attributes.js'

// =============================================================================
// Constants (mirroring Python)
// =============================================================================

/** Default embedding model name */
export const DEFAULT_SEMANTIC_MODEL = 'sentence-transformers/all-MiniLM-L6-v2'

/** Default cross-encoder reranker model */
export const DEFAULT_RERANKER_MODEL = 'cross-encoder/ms-marco-MiniLM-L-6-v2'

/** Skip reranking if top semantic score >= this threshold */
export const SEMANTIC_CONFIDENCE_THRESHOLD = 0.75

/** Maximum candidates to rerank (performance optimization) */
export const DEFAULT_TOP_N_RERANK = 20

/** Early exit if top score has this margin over second */
export const EARLY_EXIT_MARGIN = 0.15

/** Score combination weights */
export const SCORE_WEIGHT_EMBEDDING = 0.7
export const SCORE_WEIGHT_RERANKER = 0.2
export const SCORE_WEIGHT_NUMERIC = 0.1

// =============================================================================
// Types
// =============================================================================

/**
 * Input candidate for reranking
 */
export interface CandidateInput {
  id: string
  text: string
  /** TF-IDF or other lexical score (optional) */
  lexicalScore?: number
  /** Semantic similarity score from embedding search */
  semanticScore?: number
  /** Pre-extracted attributes (optional, for numeric boost) */
  attributes?: ExtractedAttributes
}

/**
 * Result after semantic reranking
 */
export interface ScoredCandidate {
  id: string
  /** Original semantic score (embedding similarity) */
  semanticScore: number
  /** Cross-encoder reranker score (normalized 0-1) */
  rerankerScore: number
  /** Numeric attribute boost (0-1) */
  numericBoost: number
  /** Combined final score */
  finalScore: number
}

/**
 * Configuration for semantic reranker
 */
export interface SemanticRerankerConfig {
  /** Weight for embedding semantic score (default: 0.7) */
  semanticWeight?: number
  /** Weight for cross-encoder reranker score (default: 0.2) */
  rerankerWeight?: number
  /** Weight for numeric attribute boost (default: 0.1) */
  numericWeight?: number
  /** Threshold to skip reranking if semantic confidence is high */
  confidenceThreshold?: number
  /** Maximum candidates to rerank */
  maxCandidatesToRerank?: number
}

/**
 * Embedding provider interface (abstraction for model backend)
 */
export interface EmbeddingProvider {
  /** Get embedding for a query text */
  embedQuery(text: string): Promise<number[]>
  /** Get embeddings for multiple document texts */
  embedDocuments(texts: string[]): Promise<number[][]>
  /** Embedding dimension */
  readonly dimension: number
}

/**
 * Cross-encoder provider interface (for reranking)
 */
export interface CrossEncoderProvider {
  /**
   * Score query-document pairs
   * @param query The search query
   * @param documents List of document texts
   * @returns Scores for each document (higher = more relevant)
   */
  score(query: string, documents: string[]): Promise<number[]>
}

/**
 * Semantic reranker interface
 */
export interface SemanticReranker {
  /**
   * Rerank candidates using semantic similarity and cross-encoder
   */
  rerank(query: string, candidates: CandidateInput[]): Promise<ScoredCandidate[]>
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Compute cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`)
  }

  let dot = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    const ai = a[i]!
    const bi = b[i]!
    dot += ai * bi
    normA += ai * ai
    normB += bi * bi
  }

  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

/**
 * L2 normalize a vector
 */
export function l2Normalize(vec: number[]): number[] {
  let norm = 0
  for (const v of vec) {
    norm += v * v
  }
  norm = Math.sqrt(norm)
  if (norm < 1e-12) return vec
  return vec.map((v) => v / norm)
}

/**
 * Normalize scores to [0, 1] using min-max normalization
 * Mirrors Python CrossEncoderReranker.normalize
 */
export function normalizeScores(scores: number[]): number[] {
  if (scores.length === 0) return []

  const min = Math.min(...scores)
  const max = Math.max(...scores)

  if (max - min < 1e-9) {
    return scores.map(() => 0.5)
  }

  return scores.map((s) => (s - min) / (max - min))
}

/**
 * Check if reranking should be skipped (lazy reranking)
 * Mirrors Python CrossEncoderReranker.should_rerank
 */
export function shouldRerank(
  semanticScores: number[],
  threshold: number = SEMANTIC_CONFIDENCE_THRESHOLD
): boolean {
  if (semanticScores.length === 0) return false

  // Assume scores are sorted descending
  const topScore = semanticScores[0] ?? 0

  // Skip reranking if top score is high enough
  if (topScore >= threshold) {
    return false
  }

  return true
}

/**
 * Compute numeric boost based on attribute matching
 * Mirrors Python numeric_boost from attributes.py
 *
 * Uses FullAttributes property names (snake_case) from attributes.ts
 */
export function computeNumericBoost(
  queryAttrs: ExtractedAttributes,
  itemAttrs: ExtractedAttributes
): number {
  let boost = 0
  let matches = 0
  let total = 0

  // Capacity (liters)
  if (queryAttrs.capacity_l != null) {
    total++
    if (itemAttrs.capacity_l != null) {
      const ratio = Math.min(queryAttrs.capacity_l, itemAttrs.capacity_l) /
                    Math.max(queryAttrs.capacity_l, itemAttrs.capacity_l)
      if (ratio >= 0.8) {
        boost += ratio
        matches++
      }
    }
  }

  // Pressure (bar)
  if (queryAttrs.pressure_bar != null) {
    total++
    if (itemAttrs.pressure_bar != null) {
      const ratio = Math.min(queryAttrs.pressure_bar, itemAttrs.pressure_bar) /
                    Math.max(queryAttrs.pressure_bar, itemAttrs.pressure_bar)
      if (ratio >= 0.8) {
        boost += ratio
        matches++
      }
    }
  }

  // Diameter (mm)
  if (queryAttrs.diameter_mm != null) {
    total++
    if (itemAttrs.diameter_mm != null) {
      const ratio = Math.min(queryAttrs.diameter_mm, itemAttrs.diameter_mm) /
                    Math.max(queryAttrs.diameter_mm, itemAttrs.diameter_mm)
      if (ratio >= 0.8) {
        boost += ratio
        matches++
      }
    }
  }

  // Voltage
  if (queryAttrs.voltage_v != null) {
    total++
    if (itemAttrs.voltage_v != null && itemAttrs.voltage_v === queryAttrs.voltage_v) {
      boost += 1.0
      matches++
    }
  }

  // RPM
  if (queryAttrs.rpm != null) {
    total++
    if (itemAttrs.rpm != null) {
      const ratio = Math.min(queryAttrs.rpm, itemAttrs.rpm) /
                    Math.max(queryAttrs.rpm, itemAttrs.rpm)
      if (ratio >= 0.9) {
        boost += ratio
        matches++
      }
    }
  }

  // Note: powerHp is not in ExtractedAttributes, skipping

  if (total === 0) return 0
  return boost / total
}

// =============================================================================
// Mock Embedding Provider (for testing without real model)
// =============================================================================

/**
 * Mock embedding provider that returns pre-defined embeddings
 * Useful for deterministic testing
 */
export class MockEmbeddingProvider implements EmbeddingProvider {
  private embeddings: Map<string, number[]>
  readonly dimension: number

  constructor(embeddings: Map<string, number[]>, dimension: number = 384) {
    this.embeddings = embeddings
    this.dimension = dimension
  }

  async embedQuery(text: string): Promise<number[]> {
    const normalized = normalizeEquip(text)
    const emb = this.embeddings.get(normalized)
    if (emb) return l2Normalize(emb)
    // Return zero vector if not found
    return new Array(this.dimension).fill(0)
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((t) => this.embedQuery(t)))
  }

  /**
   * Create from golden fixture data
   */
  static fromGolden(
    embeddings: Record<string, number[]>,
    dimension: number = 384
  ): MockEmbeddingProvider {
    const map = new Map<string, number[]>()
    for (const [key, vec] of Object.entries(embeddings)) {
      map.set(key, vec)
    }
    return new MockEmbeddingProvider(map, dimension)
  }
}

/**
 * Mock cross-encoder that returns pre-defined scores
 */
export class MockCrossEncoderProvider implements CrossEncoderProvider {
  private scores: Map<string, number>

  constructor(scores: Map<string, number> = new Map()) {
    this.scores = scores
  }

  async score(query: string, documents: string[]): Promise<number[]> {
    const qNorm = normalizeEquip(query)
    return documents.map((doc) => {
      const dNorm = normalizeEquip(doc)
      const key = `${qNorm}|||${dNorm}`
      return this.scores.get(key) ?? 0
    })
  }

  /**
   * Create from golden fixture data
   */
  static fromGolden(
    pairs: Array<{ query: string; doc: string; score: number }>
  ): MockCrossEncoderProvider {
    const map = new Map<string, number>()
    for (const p of pairs) {
      const qNorm = normalizeEquip(p.query)
      const dNorm = normalizeEquip(p.doc)
      map.set(`${qNorm}|||${dNorm}`, p.score)
    }
    return new MockCrossEncoderProvider(map)
  }
}

// =============================================================================
// Semantic Reranker Implementation
// =============================================================================

/**
 * Create a semantic reranker instance
 *
 * Mirrors the Python search pipeline:
 * 1. Compute semantic similarity (embedding cosine)
 * 2. Apply cross-encoder reranking (if confidence < threshold)
 * 3. Compute numeric attribute boost
 * 4. Combine: final = 0.7*semantic + 0.2*reranker + 0.1*numeric
 */
export function createSemanticReranker(
  embeddingProvider: EmbeddingProvider,
  crossEncoderProvider: CrossEncoderProvider,
  config: SemanticRerankerConfig = {}
): SemanticReranker {
  const semanticWeight = config.semanticWeight ?? SCORE_WEIGHT_EMBEDDING
  const rerankerWeight = config.rerankerWeight ?? SCORE_WEIGHT_RERANKER
  const numericWeight = config.numericWeight ?? SCORE_WEIGHT_NUMERIC
  const confidenceThreshold = config.confidenceThreshold ?? SEMANTIC_CONFIDENCE_THRESHOLD
  const maxCandidates = config.maxCandidatesToRerank ?? DEFAULT_TOP_N_RERANK

  return {
    async rerank(
      query: string,
      candidates: CandidateInput[]
    ): Promise<ScoredCandidate[]> {
      if (candidates.length === 0) return []

      // Normalize query
      const queryNormalized = normalizeEquip(query)

      // Step 1: Get query embedding
      const queryEmb = await embeddingProvider.embedQuery(queryNormalized)

      // Step 2: Get document embeddings
      const docTexts = candidates.map((c) => normalizeEquip(c.text))
      const docEmbs = await embeddingProvider.embedDocuments(docTexts)

      // Step 3: Compute semantic scores (cosine similarity)
      const semanticScores = docEmbs.map((docEmb) =>
        cosineSimilarity(queryEmb, docEmb)
      )

      // Step 4: Sort by semantic score to check if reranking is needed
      const sortedIndices = semanticScores
        .map((s, i) => ({ score: s, idx: i }))
        .sort((a, b) => b.score - a.score)
        .map((x) => x.idx)

      const sortedSemanticScores = sortedIndices.map((i) => semanticScores[i] ?? 0)

      // Step 5: Cross-encoder reranking (lazy)
      let rerankerScores: number[]
      if (shouldRerank(sortedSemanticScores, confidenceThreshold)) {
        // Get texts for top candidates
        const candidatesToRerank = sortedIndices.slice(0, maxCandidates)
        const textsToRerank = candidatesToRerank.map((i) => candidates[i]!.text)

        // Score with cross-encoder
        const rawScores = await crossEncoderProvider.score(query, textsToRerank)
        const normalizedScores = normalizeScores(rawScores)

        // Build full score array (0 for non-reranked)
        rerankerScores = new Array(candidates.length).fill(0) as number[]
        for (let i = 0; i < candidatesToRerank.length; i++) {
          const idx = candidatesToRerank[i]!
          rerankerScores[idx] = normalizedScores[i] ?? 0
        }
      } else {
        // Skip reranking - all zeros
        rerankerScores = new Array(candidates.length).fill(0) as number[]
      }

      // Step 6: Compute numeric boost
      const queryAttrs = extractAllAttributes(queryNormalized)
      const numericBoosts = candidates.map((c) => {
        const itemAttrs = c.attributes ?? extractAllAttributes(c.text)
        return computeNumericBoost(queryAttrs, itemAttrs)
      })

      // Step 7: Combine scores
      const results: ScoredCandidate[] = candidates.map((c, i) => {
        const semScore = semanticScores[i] ?? 0
        const rerScore = rerankerScores[i] ?? 0
        const numBoost = numericBoosts[i] ?? 0

        const finalScore =
          semanticWeight * semScore +
          rerankerWeight * rerScore +
          numericWeight * numBoost

        return {
          id: c.id,
          semanticScore: semScore,
          rerankerScore: rerScore,
          numericBoost: numBoost,
          finalScore,
        }
      })

      // Step 8: Sort by final score
      results.sort((a, b) => b.finalScore - a.finalScore)

      return results
    },
  }
}

// =============================================================================
// Simple Semantic Search Index (embedding-only, no cross-encoder)
// =============================================================================

export interface SemanticSearchResult {
  id: string
  score: number
}

/**
 * Simple semantic search using embeddings only
 * Mirrors Python SemanticSearchIndex
 */
export class SemanticSearchIndex {
  private ids: string[]
  private embeddings: number[][]
  readonly dimension: number

  private constructor(
    ids: string[],
    embeddings: number[][],
    dimension: number
  ) {
    this.ids = ids
    this.embeddings = embeddings
    this.dimension = dimension
  }

  /**
   * Build index from documents
   */
  static async build(
    docs: Array<{ id: string; text: string }>,
    embeddingProvider: EmbeddingProvider
  ): Promise<SemanticSearchIndex> {
    const ids = docs.map((d) => d.id)
    const texts = docs.map((d) => normalizeEquip(d.text))
    const embeddings = await embeddingProvider.embedDocuments(texts)

    return new SemanticSearchIndex(ids, embeddings, embeddingProvider.dimension)
  }

  /**
   * Search for similar documents
   */
  async search(
    query: string,
    embeddingProvider: EmbeddingProvider,
    topK: number = 10
  ): Promise<SemanticSearchResult[]> {
    const queryNorm = normalizeEquip(query)
    const queryEmb = await embeddingProvider.embedQuery(queryNorm)

    // Compute similarities
    const scores = this.embeddings.map((emb) => cosineSimilarity(queryEmb, emb))

    // Get top K
    const indexed = scores.map((s, i) => ({ score: s, idx: i }))
    indexed.sort((a, b) => b.score - a.score)

    return indexed.slice(0, topK).map((x) => ({
      id: this.ids[x.idx]!,
      score: x.score,
    }))
  }
}
