/**
 * Cross-Encoder Provider Factory
 *
 * Creates the appropriate CrossEncoderProvider based on configuration.
 * Supports mock and Hugging Face providers.
 */

import type { CrossEncoderProvider } from '../semanticReranker.js'
import { config, type CrossEncoderProviderMode } from '../../config/env.js'
import { StubCrossEncoderProvider } from './stubProviders.js'
import { HuggingFaceCrossEncoderProvider } from './huggingFaceCrossEncoderProvider.js'
import { logger } from '../../infra/logging.js'

/**
 * No-op cross-encoder provider
 *
 * Returns constant scores (0.5) for all documents.
 * Used when cross-encoder is disabled but search still needs to work.
 */
export class NoOpCrossEncoderProvider implements CrossEncoderProvider {
  async score(_query: string, documents: string[]): Promise<number[]> {
    // Return neutral score for all documents
    return documents.map(() => 0.5)
  }
}

/**
 * Create a cross-encoder provider based on configuration
 *
 * Provider selection is driven by CROSS_ENCODER_PROVIDER_MODE:
 * - 'mock': StubCrossEncoderProvider (deterministic, for tests/dev)
 * - 'hf': HuggingFaceCrossEncoderProvider (requires HF_API_KEY)
 * - 'none': NoOpCrossEncoderProvider (returns constant scores)
 *
 * @throws Error if mode is 'hf' and HF_API_KEY is missing
 */
export function createCrossEncoderProvider(
  mode?: CrossEncoderProviderMode
): CrossEncoderProvider {
  const providerMode = mode ?? config.crossEncoderProviderMode

  logger.info('Creating cross-encoder provider', { mode: providerMode })

  switch (providerMode) {
    case 'hf':
      return new HuggingFaceCrossEncoderProvider(
        config.hfApiKey,
        config.hfApiUrl,
        config.hfCrossEncoderModel
      )

    case 'none':
      logger.warn('Cross-encoder disabled, using no-op provider')
      return new NoOpCrossEncoderProvider()

    case 'mock':
    default:
      return new StubCrossEncoderProvider()
  }
}
