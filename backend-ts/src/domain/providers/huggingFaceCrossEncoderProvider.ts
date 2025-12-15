/**
 * Hugging Face Cross-Encoder Provider
 *
 * Uses the Hugging Face Inference API to score query-document pairs
 * using cross-encoder models like ms-marco-MiniLM-L-6-v2.
 *
 * Cross-encoders take (query, document) pairs and output relevance scores.
 * They are more accurate than bi-encoders for reranking but slower.
 *
 * API Reference:
 * https://huggingface.co/docs/api-inference/detailed_parameters#text-classification-task
 */

import type { CrossEncoderProvider } from '../semanticReranker.js'
import { logger } from '../../infra/logging.js'

// =============================================================================
// Types
// =============================================================================

interface CrossEncoderInput {
  text: string
  text_pair: string
}

interface CrossEncoderScoreResponse {
  label: string
  score: number
}

interface HuggingFaceErrorResponse {
  error?: string
  warnings?: string[]
}

// =============================================================================
// Implementation
// =============================================================================

/**
 * Hugging Face Cross-Encoder Provider
 *
 * Calls the HF Inference API to score query-document pairs.
 * Returns relevance scores (higher = more relevant).
 */
export class HuggingFaceCrossEncoderProvider implements CrossEncoderProvider {
  private readonly endpoint: string

  constructor(
    private readonly apiKey: string,
    apiUrl: string,
    modelId: string
  ) {
    if (!apiKey) {
      throw new Error(
        'HuggingFaceCrossEncoderProvider requires an API key. ' +
        'Set HF_API_KEY environment variable or use CROSS_ENCODER_PROVIDER_MODE=mock'
      )
    }

    // Cross-encoders use the text-classification pipeline
    this.endpoint = `${apiUrl}/models/${modelId}`

    logger.info('[HuggingFaceCrossEncoderProvider] Initialized', {
      modelId,
      endpoint: this.endpoint.replace(apiKey, '***'),
    })
  }

  /**
   * Score query-document pairs
   *
   * @param query - The search query
   * @param documents - List of document texts to score
   * @returns Array of scores (higher = more relevant)
   */
  async score(query: string, documents: string[]): Promise<number[]> {
    if (documents.length === 0) return []

    // Cross-encoders require individual API calls per pair
    // or batched inputs depending on the model
    // We'll batch them for efficiency
    const BATCH_SIZE = 16
    const results: number[] = []

    for (let i = 0; i < documents.length; i += BATCH_SIZE) {
      const batchDocs = documents.slice(i, i + BATCH_SIZE)
      const batchScores = await this.callApi(query, batchDocs)
      results.push(...batchScores)
    }

    return results
  }

  /**
   * Call the Hugging Face Inference API for cross-encoder scoring
   */
  private async callApi(query: string, documents: string[]): Promise<number[]> {
    const startTime = Date.now()

    try {
      // Build input pairs
      const inputs: CrossEncoderInput[] = documents.map(doc => ({
        text: query,
        text_pair: doc,
      }))

      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs,
          options: {
            wait_for_model: true,
          },
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as HuggingFaceErrorResponse
        const errorMessage = errorData.error || `HTTP ${response.status}: ${response.statusText}`
        throw new Error(`HuggingFace API error: ${errorMessage}`)
      }

      const data = await response.json()

      const duration = Date.now() - startTime
      logger.debug('[HuggingFaceCrossEncoderProvider] API call completed', {
        pairCount: documents.length,
        durationMs: duration,
      })

      // Parse the response
      return this.parseScores(data, documents.length)
    } catch (error) {
      const duration = Date.now() - startTime
      const message = error instanceof Error ? error.message : String(error)

      logger.error('[HuggingFaceCrossEncoderProvider] API call failed', {
        error: message,
        durationMs: duration,
        pairCount: documents.length,
      })

      throw error
    }
  }

  /**
   * Parse the API response to extract scores
   *
   * Cross-encoder responses can vary by model:
   * - Some return: [[{label, score}, ...]] for each pair
   * - Some return: [{label, score}, ...] for single input
   * - ms-marco models return a single score per pair
   */
  private parseScores(data: unknown, expectedCount: number): number[] {
    // Handle array of arrays (batched response)
    if (Array.isArray(data)) {
      if (data.length === 0) {
        return new Array(expectedCount).fill(0)
      }

      // Check if first item is an array (nested structure)
      if (Array.isArray(data[0])) {
        // [[{label, score}], [{label, score}], ...]
        return data.map(item => this.extractScore(item))
      }

      // Check if first item has label/score (single pair or flat array)
      if (typeof data[0] === 'object' && 'score' in data[0]) {
        // For single pair: [{label, score}]
        if (expectedCount === 1) {
          return [this.extractScore(data)]
        }
        // For multiple pairs returned flat
        return data.map((item: CrossEncoderScoreResponse) => item.score)
      }

      // If it's just numbers, return directly
      if (typeof data[0] === 'number') {
        return data as number[]
      }
    }

    // Single number response
    if (typeof data === 'number') {
      return [data]
    }

    logger.warn('[HuggingFaceCrossEncoderProvider] Unexpected response format, returning zeros', {
      dataType: typeof data,
      isArray: Array.isArray(data),
    })

    return new Array(expectedCount).fill(0)
  }

  /**
   * Extract the relevance score from a classification result
   *
   * Cross-encoder models may output:
   * - A single score (for binary classification)
   * - Multiple labels with scores (we take the positive/relevant one)
   */
  private extractScore(result: unknown): number {
    if (Array.isArray(result)) {
      // Find the "LABEL_1" or highest score (typically the positive class)
      const items = result as CrossEncoderScoreResponse[]

      // For ms-marco models, LABEL_1 is typically "relevant"
      const relevantItem = items.find(item =>
        item.label === 'LABEL_1' || item.label === 'relevant' || item.label === '1'
      )

      if (relevantItem) {
        return relevantItem.score
      }

      // Fall back to max score
      return Math.max(...items.map(item => item.score))
    }

    if (typeof result === 'object' && result !== null && 'score' in result) {
      return (result as CrossEncoderScoreResponse).score
    }

    if (typeof result === 'number') {
      return result
    }

    return 0
  }
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Create a Hugging Face cross-encoder provider from config
 */
export function createHuggingFaceCrossEncoderProvider(
  apiKey: string,
  apiUrl: string,
  modelId: string
): HuggingFaceCrossEncoderProvider {
  return new HuggingFaceCrossEncoderProvider(apiKey, apiUrl, modelId)
}
