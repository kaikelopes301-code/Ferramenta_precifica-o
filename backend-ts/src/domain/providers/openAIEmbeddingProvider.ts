/**
 * OpenAI Embedding Provider
 *
 * Uses the OpenAI Embeddings API to generate embeddings.
 * Compatible with text-embedding-3-small, text-embedding-3-large, etc.
 *
 * API Reference:
 * https://platform.openai.com/docs/api-reference/embeddings
 */

import type { EmbeddingProvider } from '../semanticReranker.js'
import { logger } from '../../infra/logging.js'

// =============================================================================
// Types
// =============================================================================

interface OpenAIEmbeddingRequest {
  input: string | string[]
  model: string
  encoding_format?: 'float' | 'base64'
}

interface OpenAIEmbeddingData {
  object: 'embedding'
  index: number
  embedding: number[]
}

interface OpenAIEmbeddingResponse {
  object: 'list'
  data: OpenAIEmbeddingData[]
  model: string
  usage: {
    prompt_tokens: number
    total_tokens: number
  }
}

interface OpenAIErrorResponse {
  error?: {
    message: string
    type: string
    code: string | null
  }
}

// Model dimensions
const MODEL_DIMENSIONS: Record<string, number> = {
  'text-embedding-3-small': 1536,
  'text-embedding-3-large': 3072,
  'text-embedding-ada-002': 1536,
}

// =============================================================================
// Implementation
// =============================================================================

/**
 * OpenAI Embedding Provider
 *
 * Calls the OpenAI API to generate embeddings.
 */
export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  readonly dimension: number
  private readonly endpoint: string

  constructor(
    private readonly apiKey: string,
    baseUrl: string,
    private readonly model: string
  ) {
    if (!apiKey) {
      throw new Error(
        'OpenAIEmbeddingProvider requires an API key. ' +
        'Set OPENAI_API_KEY environment variable or use EMBEDDINGS_PROVIDER_MODE=mock'
      )
    }

    this.endpoint = `${baseUrl}/embeddings`
    this.dimension = MODEL_DIMENSIONS[model] ?? 1536

    logger.info('[OpenAIEmbeddingProvider] Initialized', {
      model,
      dimension: this.dimension,
      endpoint: this.endpoint,
    })
  }

  /**
   * Embed a single query text
   */
  async embedQuery(text: string): Promise<number[]> {
    const embeddings = await this.callApi([text])
    const result = embeddings[0]
    if (!result) {
      throw new Error('OpenAI API returned no embedding for input')
    }
    return result
  }

  /**
   * Embed multiple document texts in a batch
   *
   * OpenAI supports up to 2048 inputs per request, but we batch
   * to avoid hitting rate limits and manage memory.
   */
  async embedDocuments(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return []

    // Batch in chunks of 100 to balance efficiency and API limits
    const BATCH_SIZE = 100
    const results: number[][] = []

    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE)
      const batchEmbeddings = await this.callApi(batch)
      results.push(...batchEmbeddings)
    }

    return results
  }

  /**
   * Call the OpenAI Embeddings API
   */
  private async callApi(inputs: string[]): Promise<number[][]> {
    const startTime = Date.now()

    try {
      const requestBody: OpenAIEmbeddingRequest = {
        input: inputs,
        model: this.model,
        encoding_format: 'float',
      }

      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as OpenAIErrorResponse
        const errorMessage = errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`
        throw new Error(`OpenAI API error: ${errorMessage}`)
      }

      const data = await response.json() as OpenAIEmbeddingResponse

      const duration = Date.now() - startTime
      logger.debug('[OpenAIEmbeddingProvider] API call completed', {
        inputCount: inputs.length,
        tokensUsed: data.usage?.total_tokens,
        durationMs: duration,
      })

      // Sort by index to ensure correct order (OpenAI may return out of order)
      const sortedData = data.data.sort((a, b) => a.index - b.index)
      return sortedData.map(item => item.embedding)
    } catch (error) {
      const duration = Date.now() - startTime
      const message = error instanceof Error ? error.message : String(error)

      logger.error('[OpenAIEmbeddingProvider] API call failed', {
        error: message,
        durationMs: duration,
        inputCount: inputs.length,
      })

      throw error
    }
  }
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Create an OpenAI embedding provider from config
 */
export function createOpenAIEmbeddingProvider(
  apiKey: string,
  baseUrl: string,
  model: string
): OpenAIEmbeddingProvider {
  return new OpenAIEmbeddingProvider(apiKey, baseUrl, model)
}
