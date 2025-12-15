/**
 * Hugging Face Embedding Provider
 *
 * Uses the Hugging Face Inference API to generate embeddings.
 * Compatible with sentence-transformers models like all-MiniLM-L6-v2.
 *
 * API Reference:
 * https://huggingface.co/docs/api-inference/detailed_parameters#feature-extraction-task
 */

import type { EmbeddingProvider } from '../semanticReranker.js'
import { logger } from '../../infra/logging.js'

// =============================================================================
// Types
// =============================================================================

interface HuggingFaceErrorResponse {
  error?: string
  warnings?: string[]
}

// =============================================================================
// Implementation
// =============================================================================

/**
 * Hugging Face Embedding Provider
 *
 * Calls the HF Inference API to generate embeddings using
 * sentence-transformer models.
 */
export class HuggingFaceEmbeddingProvider implements EmbeddingProvider {
  readonly dimension: number = 384 // all-MiniLM-L6-v2 dimension
  private readonly endpoint: string

  constructor(
    private readonly apiKey: string,
    apiUrl: string,
    modelId: string
  ) {
    if (!apiKey) {
      throw new Error(
        'HuggingFaceEmbeddingProvider requires an API key. ' +
        'Set HF_API_KEY environment variable or use EMBEDDINGS_PROVIDER_MODE=mock'
      )
    }

    this.endpoint = `${apiUrl}/pipeline/feature-extraction/${modelId}`

    logger.info('[HuggingFaceEmbeddingProvider] Initialized', {
      modelId,
      endpoint: this.endpoint.replace(apiKey, '***'),
    })
  }

  /**
   * Embed a single query text
   */
  async embedQuery(text: string): Promise<number[]> {
    const embeddings = await this.callApi([text])
    if (!embeddings[0]) {
      throw new Error('No embedding returned for query')
    }
    return embeddings[0]
  }

  /**
   * Embed multiple document texts in a batch
   */
  async embedDocuments(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return []

    // HF API supports batching, but may have limits
    // For safety, batch in chunks of 32
    const BATCH_SIZE = 32
    const results: number[][] = []

    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE)
      const batchEmbeddings = await this.callApi(batch)
      results.push(...batchEmbeddings)
    }

    return results
  }

  /**
   * Call the Hugging Face Inference API
   */
  private async callApi(inputs: string[]): Promise<number[][]> {
    const startTime = Date.now()

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs,
          options: {
            wait_for_model: true, // Wait if model is loading
          },
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as HuggingFaceErrorResponse
        const errorMessage = errorData.error || `HTTP ${response.status}: ${response.statusText}`
        throw new Error(`HuggingFace API error: ${errorMessage}`)
      }

      const data = await response.json() as number[][] | number[][][]

      const duration = Date.now() - startTime
      logger.debug('[HuggingFaceEmbeddingProvider] API call completed', {
        inputCount: inputs.length,
        durationMs: duration,
      })

      // Handle response format
      // sentence-transformers returns: [[emb1], [emb2], ...] for batch
      // or [emb] for single input
      return this.normalizeResponse(data, inputs.length)
    } catch (error) {
      const duration = Date.now() - startTime
      const message = error instanceof Error ? error.message : String(error)

      logger.error('[HuggingFaceEmbeddingProvider] API call failed', {
        error: message,
        durationMs: duration,
        inputCount: inputs.length,
      })

      throw error
    }
  }

  /**
   * Normalize the API response to always be number[][]
   */
  private normalizeResponse(data: unknown, _expectedCount: number): number[][] {
    // Check if it's a 3D array (batched sentence-transformers response)
    if (Array.isArray(data) && data.length > 0) {
      const firstItem = data[0] as unknown

      // If first item is also an array of arrays, it's 3D
      if (Array.isArray(firstItem) && firstItem.length > 0 && Array.isArray(firstItem[0])) {
        // 3D: [[emb1], [emb2]] - need to flatten one level
        // This happens with some models that return token-level embeddings
        // We take the mean pooling (average of all token embeddings)
        return (data as number[][][]).map(tokenEmbeddings => {
          if (tokenEmbeddings.length === 1 && tokenEmbeddings[0]) {
            return tokenEmbeddings[0]
          }
          // Mean pooling
          return this.meanPool(tokenEmbeddings)
        })
      }

      // If first item is an array of numbers, it's already 2D
      if (Array.isArray(firstItem) && typeof firstItem[0] === 'number') {
        return data as number[][]
      }

      // Single embedding (1D array)
      if (typeof firstItem === 'number') {
        return [data as unknown as number[]]
      }
    }

    throw new Error(`Unexpected HuggingFace API response format`)
  }

  /**
   * Mean pooling for token-level embeddings
   */
  private meanPool(tokenEmbeddings: number[][]): number[] {
    if (tokenEmbeddings.length === 0) return []

    const firstEmbedding = tokenEmbeddings[0]
    if (!firstEmbedding) return []
    
    const dimension = firstEmbedding.length
    const result: number[] = new Array<number>(dimension).fill(0)

    for (const embedding of tokenEmbeddings) {
      for (let i = 0; i < dimension; i++) {
        const val = embedding[i]
        if (val !== undefined) {
          result[i] = (result[i] ?? 0) + val
        }
      }
    }

    const count = tokenEmbeddings.length
    for (let i = 0; i < dimension; i++) {
      result[i] = (result[i] ?? 0) / count
    }

    return result
  }
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Create a Hugging Face embedding provider from config
 */
export function createHuggingFaceEmbeddingProvider(
  apiKey: string,
  apiUrl: string,
  modelId: string
): HuggingFaceEmbeddingProvider {
  return new HuggingFaceEmbeddingProvider(apiKey, apiUrl, modelId)
}
