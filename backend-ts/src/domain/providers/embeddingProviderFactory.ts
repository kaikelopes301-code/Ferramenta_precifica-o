/**
 * Embedding Provider Factory
 *
 * Creates the appropriate EmbeddingProvider based on configuration.
 * Supports mock, OpenAI, and Hugging Face providers.
 */

import type { EmbeddingProvider } from '../semanticReranker.js'
import { config, type EmbeddingsProviderMode } from '../../config/env.js'
import { StubEmbeddingProvider } from './stubProviders.js'
import { HuggingFaceEmbeddingProvider } from './huggingFaceEmbeddingProvider.js'
import { OpenAIEmbeddingProvider } from './openAIEmbeddingProvider.js'
import { logger } from '../../infra/logging.js'

/**
 * Create an embedding provider based on configuration
 *
 * Provider selection is driven by EMBEDDINGS_PROVIDER_MODE:
 * - 'mock': StubEmbeddingProvider (deterministic, for tests/dev)
 * - 'openai': OpenAIEmbeddingProvider (requires OPENAI_API_KEY)
 * - 'hf': HuggingFaceEmbeddingProvider (requires HF_API_KEY)
 * - 'none': Throws error (semantic search not supported)
 *
 * @throws Error if mode is 'none' or if required API key is missing
 */
export function createEmbeddingProvider(
  mode?: EmbeddingsProviderMode
): EmbeddingProvider {
  const providerMode = mode ?? config.embeddingsProviderMode

  logger.info('Creating embedding provider', { mode: providerMode })

  switch (providerMode) {
    case 'hf':
      return new HuggingFaceEmbeddingProvider(
        config.hfApiKey,
        config.hfApiUrl,
        config.hfEmbeddingsModel
      )

    case 'openai':
      return new OpenAIEmbeddingProvider(
        config.openaiApiKey,
        config.openaiBaseUrl,
        config.openaiEmbeddingsModel
      )

    case 'none':
      throw new Error(
        "EmbeddingsProvider mode 'none' is not supported for semantic search. " +
        "Set EMBEDDINGS_PROVIDER_MODE to 'mock', 'hf', or 'openai'."
      )

    case 'mock':
    default:
      return new StubEmbeddingProvider()
  }
}
