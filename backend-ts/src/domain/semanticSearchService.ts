/**
 * In-Memory Semantic Search Service
 * 
 * Provides cosine similarity search over pre-computed embeddings without FAISS or external dependencies.
 * Uses only embeddings already stored in CorpusDocument (no expensive embedding generation for corpus).
 * 
 * Architecture:
 * - Lazy loading: embeddings loaded from corpus on first search
 * - Pure CPU computation: dot product + L2 normalization
 * - No external services: works entirely offline
 * 
 * Performance:
 * - O(n) search complexity (linear scan)
 * - Fast for small/medium corpora (<10k documents)
 * - For large corpora (>100k), consider FAISS or approximate nearest neighbors
 * 
 * Memory footprint:
 * - ~1.5KB per document (384 dims × 4 bytes + metadata)
 * - 1000 docs ≈ 1.5MB
 * - 10000 docs ≈ 15MB
 */

import type { CorpusRepository } from './searchEngine.js';
import type { EmbeddingClient } from '../infra/embeddingClient.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Single semantic search result
 */
export interface SemanticSearchResult {
  /** Document ID from corpus */
  docId: string;
  /** Cosine similarity score (0..1, higher is better) */
  score: number;
}

/**
 * Semantic search service interface
 */
export interface SemanticSearchService {
  /**
   * Search for documents similar to query text
   * 
   * @param query Query text (will be embedded by EmbeddingClient)
   * @param topK Number of results to return
   * @returns Top-K most similar documents, sorted by score (descending)
   */
  search(query: string, topK: number): Promise<SemanticSearchResult[]>;

  /**
   * Get statistics about loaded embeddings
   */
  getStats(): { loaded: boolean; count: number; dimension: number };

  /**
   * Manually trigger embedding loading (eager loading)
   */
  load(): Promise<void>;
}

// =============================================================================
// In-Memory Implementation
// =============================================================================

/**
 * In-memory semantic search using cosine similarity
 * 
 * Uses pre-computed embeddings from CorpusDocument.
 * Only generates embeddings for queries (not for corpus).
 */
export class InMemorySemanticSearchService implements SemanticSearchService {
  private docIds: string[] = [];
  private embeddings: number[][] = [];
  private norms: number[] = [];
  private isLoaded = false;
  private readonly embeddingDimension: number;

  constructor(
    private readonly corpusRepository: CorpusRepository,
    private readonly embeddingClient: EmbeddingClient
  ) {
    this.embeddingDimension = embeddingClient.dimension;
  }

  /**
   * Lazy-load embeddings from corpus repository
   * Only loads once, then caches in memory
   */
  private async ensureLoaded(): Promise<void> {
    if (this.isLoaded) return;

    console.log('[SemanticSearch] Loading embeddings from corpus...');
    const startTime = Date.now();

    try {
      const documents = await this.corpusRepository.getAllDocuments();

      // Filter documents that have valid embeddings
      let validCount = 0;
      let skippedCount = 0;

      for (const doc of documents) {
        // Skip if no embedding
        if (!doc.embedding || !Array.isArray(doc.embedding) || doc.embedding.length === 0) {
          skippedCount++;
          continue;
        }

        // Validate dimension
        if (doc.embedding.length !== this.embeddingDimension) {
          console.warn(
            `[SemanticSearch] Document ${doc.id} has embedding dimension ${doc.embedding.length}, ` +
            `expected ${this.embeddingDimension}. Skipping.`
          );
          skippedCount++;
          continue;
        }

        // Compute L2 norm for cosine similarity
        const norm = this.computeNorm(doc.embedding);
        
        if (norm === 0) {
          console.warn(`[SemanticSearch] Document ${doc.id} has zero-norm embedding. Skipping.`);
          skippedCount++;
          continue;
        }

        // Store valid embedding
        this.docIds.push(doc.id);
        this.embeddings.push(doc.embedding);
        this.norms.push(norm);
        validCount++;
      }

      this.isLoaded = true;

      const duration = Date.now() - startTime;
      console.log(
        `[SemanticSearch] Loaded ${validCount} embeddings in ${duration}ms ` +
        `(skipped ${skippedCount} documents without valid embeddings)`
      );

      if (validCount === 0) {
        console.error(
          '[SemanticSearch] No documents with valid embeddings found! ' +
          'Semantic search will return empty results. ' +
          'Run "npm run build:embeddings" to generate embeddings.'
        );
      }

    } catch (error) {
      console.error('[SemanticSearch] Failed to load embeddings:', error);
      throw error;
    }
  }

  /**
   * Search for documents semantically similar to query
   * 
   * @param query Query text
   * @param topK Number of results to return
   * @returns Top-K similar documents, sorted by cosine similarity (descending)
   */
  async search(query: string, topK: number): Promise<SemanticSearchResult[]> {
    // Ensure embeddings are loaded
    await this.ensureLoaded();

    // If no embeddings available, return empty
    if (this.docIds.length === 0) {
      return [];
    }

    // Generate query embedding
    let queryEmbedding: number[];
    try {
      queryEmbedding = await this.embeddingClient.embed(query);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to generate query embedding: ${errorMsg}`);
    }

    // Validate query embedding dimension
    if (queryEmbedding.length !== this.embeddingDimension) {
      console.error(
        `[SemanticSearch] Query embedding dimension mismatch: ` +
        `got ${queryEmbedding.length}, expected ${this.embeddingDimension}. ` +
        `Cannot perform search.`
      );
      return [];
    }

    // Compute query norm
    const queryNorm = this.computeNorm(queryEmbedding);
    if (queryNorm === 0) {
      console.error('[SemanticSearch] Query embedding has zero norm. Cannot compute similarity.');
      return [];
    }

    // Compute cosine similarity for all documents
    const results: SemanticSearchResult[] = [];

    for (let i = 0; i < this.embeddings.length; i++) {
      const docEmbedding = this.embeddings[i];
      const docNorm = this.norms[i];

      // Compute dot product
      let dotProduct = 0;
      for (let j = 0; j < this.embeddingDimension; j++) {
        dotProduct += docEmbedding[j] * queryEmbedding[j];
      }

      // Cosine similarity = dot product / (norm1 * norm2)
      const cosineSimilarity = dotProduct / (docNorm * queryNorm);

      results.push({
        docId: this.docIds[i],
        score: cosineSimilarity,
      });
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    // Return top-K
    return results.slice(0, topK);
  }

  /**
   * Compute L2 norm (Euclidean norm) of a vector
   * 
   * @param vector Input vector
   * @returns sqrt(sum(x^2))
   */
  private computeNorm(vector: number[]): number {
    let sumSquares = 0;
    for (const value of vector) {
      sumSquares += value * value;
    }
    return Math.sqrt(sumSquares);
  }

  /**
   * Get statistics about loaded embeddings
   * Useful for debugging and monitoring
   */
  getStats(): { loaded: boolean; count: number; dimension: number } {
    return {
      loaded: this.isLoaded,
      count: this.docIds.length,
      dimension: this.embeddingDimension,
    };
  }

  /**
   * Manually trigger embedding loading (useful for eager loading)
   * Normally embeddings are lazy-loaded on first search
   */
  async load(): Promise<void> {
    await this.ensureLoaded();
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create an in-memory semantic search service
 * 
 * @param corpusRepository Repository providing documents with embeddings
 * @param embeddingClient Client for generating query embeddings (not corpus)
 * @returns Configured semantic search service
 */
export function createSemanticSearchService(
  corpusRepository: CorpusRepository,
  embeddingClient: EmbeddingClient
): SemanticSearchService {
  return new InMemorySemanticSearchService(corpusRepository, embeddingClient);
}
