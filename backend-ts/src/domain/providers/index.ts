/**
 * Providers Index
 *
 * Re-exports provider implementations and factories.
 */

// Stub providers (for tests and dev)
export {
  StubEmbeddingProvider,
  StubCrossEncoderProvider,
  createStubEmbeddingProvider,
  createStubCrossEncoderProvider,
} from './stubProviders.js'

// Hugging Face providers
export {
  HuggingFaceEmbeddingProvider,
  createHuggingFaceEmbeddingProvider,
} from './huggingFaceEmbeddingProvider.js'

export {
  HuggingFaceCrossEncoderProvider,
  createHuggingFaceCrossEncoderProvider,
} from './huggingFaceCrossEncoderProvider.js'

// OpenAI providers
export {
  OpenAIEmbeddingProvider,
  createOpenAIEmbeddingProvider,
} from './openAIEmbeddingProvider.js'

// Factories
export { createEmbeddingProvider } from './embeddingProviderFactory.js'
export {
  createCrossEncoderProvider,
  NoOpCrossEncoderProvider,
} from './crossEncoderProviderFactory.js'
