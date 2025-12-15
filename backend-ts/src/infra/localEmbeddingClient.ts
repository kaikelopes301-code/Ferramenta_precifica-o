/**
 * Local Embedding Client - TypeScript native embeddings using Transformers.js
 * 
 * Uses @huggingface/transformers to run models locally in Node.js (no HTTP, no Python).
 * 
 * Model: Xenova/paraphrase-multilingual-MiniLM-L12-v2
 * - Multilingual support (Portuguese, English, etc.)
 * - Generates 384-dimensional embeddings
 * - Optimized for semantic similarity tasks
 * 
 * Architecture:
 * - Singleton pattern for model loading (lazy initialization)
 * - Mean pooling over token embeddings (standard for sentence transformers)
 * - L2 normalization for cosine similarity via dot product
 * 
 * Usage:
 * ```typescript
 * import { LocalEmbeddingClient } from './infra/localEmbeddingClient';
 * 
 * const client = new LocalEmbeddingClient();
 * const embedding = await client.embed("Lavadora de piso industrial");
 * console.log(embedding.length); // 384
 * ```
 * 
 * Performance:
 * - First call loads model (~60MB download, cached to ~/.cache/huggingface/)
 * - Subsequent calls use cached model (fast)
 * - CPU inference (GPU support via ONNX runtime)
 * 
 * @see https://huggingface.co/Xenova/paraphrase-multilingual-MiniLM-L12-v2
 * @see https://github.com/xenova/transformers.js
 */

import { pipeline } from '@huggingface/transformers';

/**
 * Minimal EmbeddingClient interface for local/remote compatibility
 */
export interface EmbeddingClient {
  /**
   * Generate embedding vector for a single text
   * @param text Input text (will be normalized internally by model)
   * @returns Promise resolving to embedding array (384 dimensions for MiniLM-L12-v2)
   */
  embed(text: string): Promise<number[]>;

  /**
   * Get embedding dimension (model-specific)
   */
  readonly dimension: number;

  /**
   * Get model identifier
   */
  readonly modelName: string;
}

/**
 * Local embedding client using Transformers.js
 * 
 * Loads models locally (no API calls, no Python server).
 * Uses Xenova/paraphrase-multilingual-MiniLM-L12-v2 by default.
 */
export class LocalEmbeddingClient implements EmbeddingClient {
  public readonly dimension = 384; // MiniLM-L12-v2 output size
  public readonly modelName: string;

  private extractor: any | null = null;
  private loadingPromise: Promise<any> | null = null;

  /**
   * @param modelName HuggingFace model identifier (default: Xenova/paraphrase-multilingual-MiniLM-L12-v2)
   */
  constructor(modelName = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2') {
    this.modelName = modelName;
  }

  /**
   * Lazy-load the feature extraction pipeline
   * Singleton pattern: ensures model loads only once even with concurrent calls
   */
  private async getExtractor(): Promise<any> {
    // Return cached extractor if already loaded
    if (this.extractor) {
      return this.extractor;
    }

    // If loading is in progress, wait for it
    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    // Start loading (cache promise to avoid duplicate loads)
    this.loadingPromise = pipeline('feature-extraction', this.modelName, {
      // Optional: quantization for faster inference (int8)
      // quantized: true,
    });

    try {
      this.extractor = await this.loadingPromise;
      return this.extractor;
    } catch (error) {
      // Reset promise on failure to allow retry
      this.loadingPromise = null;
      throw new Error(
        `Failed to load embedding model "${this.modelName}": ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Generate embedding for a single text
   * 
   * @param text Input text (any length, model handles tokenization)
   * @returns 384-dimensional embedding vector (L2-normalized)
   * @throws Error if model loading fails or text is empty
   */
  async embed(text: string): Promise<number[]> {
    if (!text || text.trim().length === 0) {
      throw new Error('Cannot embed empty text');
    }

    try {
      const extractor = await this.getExtractor();

      // Generate embeddings with mean pooling and normalization
      const output = await extractor(text, {
        pooling: 'mean', // Average over token embeddings (sentence-transformers default)
        normalize: true, // L2 normalization for cosine similarity via dot product
      });

      // Extract raw array from Tensor
      // Output shape: [1, 384] -> flatten to [384]
      const embedding = Array.from(output.data as Float32Array);

      if (embedding.length !== this.dimension) {
        throw new Error(
          `Unexpected embedding dimension: got ${embedding.length}, expected ${this.dimension}`
        );
      }

      return embedding;
    } catch (error) {
      throw new Error(
        `Embedding generation failed for text "${text.slice(0, 50)}...": ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Batch embedding generation (more efficient than multiple embed() calls)
   * 
   * @param texts Array of input texts
   * @returns Array of embedding vectors (same order as input)
   * @throws Error if any text is empty or model fails
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    // Validate all texts
    for (let i = 0; i < texts.length; i++) {
      if (!texts[i] || texts[i].trim().length === 0) {
        throw new Error(`Cannot embed empty text at index ${i}`);
      }
    }

    try {
      const extractor = await this.getExtractor();

      // Batch inference (more efficient than sequential calls)
      const output = await extractor(texts, {
        pooling: 'mean',
        normalize: true,
      });

      // Extract embeddings from Tensor
      // Output shape: [N, 384] -> convert to number[][]
      const embeddings: number[][] = [];
      const data = Array.from(output.data as Float32Array);

      for (let i = 0; i < texts.length; i++) {
        const start = i * this.dimension;
        const end = start + this.dimension;
        embeddings.push(data.slice(start, end));
      }

      return embeddings;
    } catch (error) {
      throw new Error(
        `Batch embedding generation failed for ${texts.length} texts: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Compute cosine similarity between two embeddings
   * Since embeddings are L2-normalized, cosine = dot product
   * 
   * @param a First embedding vector
   * @param b Second embedding vector
   * @returns Similarity score in [-1, 1] (1 = identical, -1 = opposite)
   */
  static cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error(`Dimension mismatch: ${a.length} vs ${b.length}`);
    }

    let dotProduct = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
    }

    return dotProduct; // Already normalized, so dot product = cosine
  }
}

/**
 * Factory function for embedding client
 * 
 * @param type 'local' for LocalEmbeddingClient, 'http' for HttpEmbeddingClient (future)
 * @param options Configuration options
 * @returns Configured EmbeddingClient instance
 */
export function createEmbeddingClient(
  type: 'local',
  options?: { modelName?: string }
): EmbeddingClient {
  if (type === 'local') {
    return new LocalEmbeddingClient(options?.modelName);
  }

  throw new Error(`Unknown embedding client type: ${type}`);
}
