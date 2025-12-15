/**
 * Route Dependencies
 *
 * Provides dependency injection for route handlers.
 * This allows swapping implementations (e.g., search engines) via configuration.
 *
 * Provider selection is driven by environment variables:
 * - EMBEDDINGS_PROVIDER_MODE: mock (default), openai, hf, none
 * - CROSS_ENCODER_PROVIDER_MODE: mock (default), hf, none
 */

import type { SearchEngine, CorpusRepository } from '../domain/searchEngine.js'
import { createSearchEngine } from '../domain/searchEngineFactory.js'
import { createFileCorpusRepository } from '../domain/corpus/index.js'
import {
  createEmbeddingProvider,
  createCrossEncoderProvider,
} from '../domain/providers/index.js'
import { config } from '../config/env.js'
import { logger } from '../infra/logging.js'

// =============================================================================
// Singleton Instances
// =============================================================================

let searchEngineInstance: SearchEngine | null = null
let corpusRepositoryInstance: CorpusRepository | null = null

/**
 * Get the corpus repository instance
 *
 * Creates the repository on first call using the configured dataset path.
 * Returns the same instance on subsequent calls (singleton pattern).
 */
export function getCorpusRepository(): CorpusRepository {
  if (!corpusRepositoryInstance) {
    logger.info('Initializing corpus repository', { path: config.datasetPath })
    corpusRepositoryInstance = createFileCorpusRepository(config.datasetPath)
  }
  return corpusRepositoryInstance
}

/**
 * Get the configured search engine instance
 *
 * Creates the engine on first call based on SEARCH_ENGINE_MODE config.
 * Provider selection is driven by EMBEDDINGS_PROVIDER_MODE and
 * CROSS_ENCODER_PROVIDER_MODE environment variables.
 *
 * Returns the same instance on subsequent calls.
 */
export function getSearchEngine(): SearchEngine {
  if (!searchEngineInstance) {
    logger.info('Initializing search engine', {
      mode: config.searchEngineMode,
      embeddingsProvider: config.embeddingsProviderMode,
      crossEncoderProvider: config.crossEncoderProviderMode,
    })

    // For Python mode, no additional providers needed
    if (config.searchEngineMode === 'python') {
      searchEngineInstance = createSearchEngine({
        mode: 'python',
      })
    } else {
      // For TS or dual mode, create providers via factories
      // Factory selection is based on env vars (mock by default)
      const corpusRepository = getCorpusRepository()
      const embeddingProvider = createEmbeddingProvider()
      const crossEncoderProvider = createCrossEncoderProvider()

      searchEngineInstance = createSearchEngine({
        mode: config.searchEngineMode,
        corpusRepository,
        embeddingProvider,
        crossEncoderProvider,
      })
    }
  }

  return searchEngineInstance
}

/**
 * Set the corpus repository instance (for testing)
 */
export function setCorpusRepository(repository: CorpusRepository): void {
  corpusRepositoryInstance = repository
  logger.info('Corpus repository instance set')
}

/**
 * Set the search engine instance (for testing)
 */
export function setSearchEngine(engine: SearchEngine): void {
  searchEngineInstance = engine
  logger.info('Search engine instance set', { engine: engine.name })
}

/**
 * Reset all instances (for testing)
 */
export function resetInstances(): void {
  searchEngineInstance = null
  corpusRepositoryInstance = null
  logger.info('All dependency instances reset')
}

/**
 * @deprecated Use resetInstances instead
 */
export function resetSearchEngine(): void {
  resetInstances()
}
