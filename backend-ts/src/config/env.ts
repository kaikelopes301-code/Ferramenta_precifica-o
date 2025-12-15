/**
 * Environment configuration
 *
 * Reads environment variables and provides typed config object.
 * Mirrors the Python runtime configuration pattern.
 */

import { parseEngineMode, SearchEngineMode } from '../domain/searchEngine.js'

// =============================================================================
// Provider Mode Types
// =============================================================================

/**
 * Embedding provider mode
 * - 'mock': Use stub provider (deterministic, for tests/dev)
 * - 'openai': Use OpenAI embeddings API
 * - 'azure': Use Azure OpenAI embeddings API
 * - 'hf': Use Hugging Face Inference API
 * - 'none': Disable embeddings (will throw if semantic search is used)
 */
export type EmbeddingsProviderMode = 'mock' | 'openai' | 'azure' | 'hf' | 'none'

/**
 * Generic embedding provider type (for low-level HTTP client)
 * - 'local': Use LocalEmbeddingClient (default, no HTTP, CPU-based)
 * - 'openai': Use OpenAI API format
 * - 'azure': Use Azure OpenAI API format
 * - 'custom': Use custom HTTP endpoint (OpenAI-compatible)
 */
export type EmbeddingProvider = 'local' | 'openai' | 'azure' | 'custom'

/**
 * Cross-encoder provider mode
 * - 'mock': Use stub provider (deterministic, for tests/dev)
 * - 'hf': Use Hugging Face Inference API
 * - 'none': Disable cross-encoder (uses constant scores)
 */
export type CrossEncoderProviderMode = 'mock' | 'hf' | 'none'

/**
 * Runtime profile for resource management
 * - 'default': Normal development/production settings
 * - 'free_tier': Optimized for low-resource environments (512MB-1GB RAM)
 */
export type RuntimeProfile = 'default' | 'free_tier'

// =============================================================================
// Helper Functions
// =============================================================================

function getEnvString(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue
}

function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key]
  if (value === undefined) return defaultValue
  const parsed = parseInt(value, 10)
  return isNaN(parsed) ? defaultValue : parsed
}

function getEnvBoolean(key: string, defaultValue: boolean): boolean {
  const value = process.env[key]
  if (value === undefined) return defaultValue
  return value.toLowerCase() === 'true' || value === '1'
}

function getEnvEngineMode(key: string): SearchEngineMode {
  const value = process.env[key]
  return parseEngineMode(value)
}

function getEnvEmbeddingsMode(key: string): EmbeddingsProviderMode {
  const value = process.env[key]?.toLowerCase()
  if (value === 'openai') return 'openai'
  if (value === 'azure') return 'azure'
  if (value === 'hf' || value === 'huggingface') return 'hf'
  if (value === 'none') return 'none'
  return 'mock' // default
}

function getEnvEmbeddingProvider(key: string): EmbeddingProvider {
  const value = process.env[key]?.toLowerCase()
  if (value === 'openai') return 'openai'
  if (value === 'azure') return 'azure'
  if (value === 'custom') return 'custom'
  return 'local' // default: local embeddings (no HTTP)
}

function getEnvCrossEncoderMode(key: string): CrossEncoderProviderMode {
  const value = process.env[key]?.toLowerCase()
  if (value === 'hf' || value === 'huggingface') return 'hf'
  if (value === 'none') return 'none'
  return 'mock' // default
}

// =============================================================================
// Configuration Object
// =============================================================================

export const config = {
  /** Port to listen on */
  port: getEnvNumber('PORT', 4000),

  /** Base URL of the Python backend */
  pythonApiBaseUrl: getEnvString('PYTHON_API_BASE_URL', 'http://localhost:8000'),

  /**
   * Runtime profile for resource management
   *
   * - 'default': Normal development/production settings
   * - 'free_tier': Optimized for low-resource cloud environments
   *   (limited CPU/RAM, conservative timeouts, smaller limits)
   *
   * @env RUNTIME_PROFILE
   * @default default
   */
  runtimeProfile: getEnvString('RUNTIME_PROFILE', 'default') as RuntimeProfile,

  /** Log level */
  logLevel: getEnvString('LOG_LEVEL', 'info'),

  /** Enable request logging */
  enableRequestLogging: getEnvBoolean('ENABLE_REQUEST_LOGGING', true),

  /** Request timeout in milliseconds */
  requestTimeoutMs: getEnvNumber('REQUEST_TIMEOUT_MS', 30000),

  /** Node environment */
  nodeEnv: getEnvString('NODE_ENV', 'development'),

  /**
   * Search engine mode
   *
   * - 'python': Use Python backend (legacy/emergency mode)
   * - 'ts': Use TypeScript native engine with automatic Python fallback (DEFAULT for production)
   * - 'dual': Run both and log comparison (Python is authoritative)
   *
   * @env SEARCH_ENGINE_MODE
   * @default ts
   */
  searchEngineMode: getEnvEngineMode('SEARCH_ENGINE_MODE'),

  /**
   * Dual mode sample rate (0.0-1.0)
   *
   * When searchEngineMode is 'dual', this controls what percentage of requests
   * execute both Python and TS engines for comparison. Python remains authoritative.
   *
   * - 0.0: Never compare (effectively same as 'python' mode)
   * - 0.1: Compare 10% of requests (recommended for production)
   * - 1.0: Compare 100% of requests (high overhead, for testing only)
   *
   * @env DUAL_SAMPLE_RATE
   * @default 0.1
   */
  dualSampleRate: Math.max(0.0, Math.min(1.0, getEnvNumber('DUAL_SAMPLE_RATE', 10) / 100)),

  /**
   * Enable debug info in search results
   *
   * When enabled, search results include timing breakdowns, domain classification,
   * and other observability data. Adds ~5-10% overhead.
   *
   * @env ENABLE_DEBUG_INFO
   * @default false
   */
  enableDebugInfo: getEnvBoolean('ENABLE_DEBUG_INFO', false),

  /**
   * Enable intent-based reranker (post-BM25)
   *
   * When enabled, search results are reranked using deterministic intent detection
   * to prioritize equipment over accessories when appropriate.
   * Fixes issue: "enceradeira 510 c/ discos" ranking "disco" higher than "enceradeira".
   *
   * @env SEARCH_RERANKER_ENABLED
   * @default true
   */
  searchRerankerEnabled: getEnvBoolean('SEARCH_RERANKER_ENABLED', true),

  // ===========================================================================
  // Mixed Query Configuration (Equipamento + Acessórios)
  // ===========================================================================

  /**
   * Always remove accessory terms from core query in mixed queries
   *
   * When enabled, queries like "enceradeira 510 c/ discos e escovas" will search
   * using only "enceradeira 510" (coreQuery), preventing accessories from dominating BM25.
   *
   * @env SEARCH_MIXED_COREQUERY_ALWAYS
   * @default true
   */
  searchMixedCoreQueryAlways: getEnvBoolean('SEARCH_MIXED_COREQUERY_ALWAYS', true),

  /**
   * Synonym expansion mode for mixed queries
   *
   * - disabled: no synonyms for mixed queries
   * - equipment_only: expand only equipment terms, not accessories
   * - full: expand all terms (not recommended)
   *
   * @env SEARCH_SYNONYMS_MIXED_MODE
   * @default disabled
   */
  searchSynonymsMixedMode: getEnvString('SEARCH_SYNONYMS_MIXED_MODE', 'disabled') as 'disabled' | 'equipment_only' | 'full',

  /**
   * Enable small bonus for equipment docs matching accessory terms
   *
   * When enabled, equipment documents (not accessories) get a small boost
   * if they mention the accessory terms from the query.
   *
   * @env SEARCH_ACCESSORY_BONUS_ENABLED
   * @default true
   */
  searchAccessoryBonusEnabled: getEnvBoolean('SEARCH_ACCESSORY_BONUS_ENABLED', true),

  /**
   * Confidence penalty for queries with accessory terms
   *
   * Reduces confidence score when query contains accessories, since it's ambiguous
   * (could be looking for equipment, accessories, or a kit).
   *
   * @env SEARCH_ACCESSORY_CONFIDENCE_PENALTY
   * @default 0.08
   */
  searchAccessoryConfidencePenalty: Math.max(0, Math.min(0.5, getEnvNumber('SEARCH_ACCESSORY_CONFIDENCE_PENALTY', 8) / 100)),

  // ===========================================================================
  // Reranker Weight Configuration
  // ===========================================================================

  /**
   * Penalty weight for accessory documents when intent is EQUIPAMENTO
   *
   * @env RERANK_ACCESSORY_PENALTY
   * @default 0.95
   */
  rerankAccessoryPenalty: Math.max(0, Math.min(1.5, getEnvNumber('RERANK_ACCESSORY_PENALTY', 95) / 100)),

  /**
   * Boost weight for exact model number matches
   *
   * @env RERANK_MODEL_BOOST
   * @default 0.45
   */
  rerankModelBoost: Math.max(0, Math.min(1.0, getEnvNumber('RERANK_MODEL_BOOST', 45) / 100)),

  /**
   * Boost weight for category matches
   *
   * @env RERANK_CATEGORY_BOOST
   * @default 0.30
   */
  rerankCategoryBoost: Math.max(0, Math.min(1.0, getEnvNumber('RERANK_CATEGORY_BOOST', 30) / 100)),

  /**
   * Weight for normalized BM25 score in final ranking
   *
   * @env RERANK_BM25_WEIGHT
   * @default 0.35
   */
  rerankBm25Weight: Math.max(0, Math.min(1.0, getEnvNumber('RERANK_BM25_WEIGHT', 35) / 100)),

  /**
   * Penalty for documents missing the model number when query has one
   *
   * @env RERANK_MISSING_MODEL_PENALTY
   * @default 0.55
   */
  rerankMissingModelPenalty: Math.max(0, Math.min(1.5, getEnvNumber('RERANK_MISSING_MODEL_PENALTY', 55) / 100)),

  /**
   * Hard guard: force TOP1 to be EQUIPAMENTO when intent is EQUIPAMENTO
   *
   * If enabled and top result is an accessory while intent is EQUIPAMENTO,
   * swap it with the highest-ranked equipment document.
   *
   * @env RERANK_HARD_TOP1_EQUIPMENT
   * @default true
   */
  rerankHardTop1Equipment: getEnvBoolean('RERANK_HARD_TOP1_EQUIPMENT', true),

  // ===========================================================================
  // TypeScript Engine Fallback Configuration
  // ===========================================================================

  /**
   * TS engine timeout in milliseconds
   *
   * When searchEngineMode is 'ts', this is the maximum time to wait for the
   * TS engine before falling back to Python. Set to 0 to disable timeout.
   *
   * @env TS_FALLBACK_TIMEOUT_MS
   * @default 2500
   */
  tsFallbackTimeoutMs: getEnvNumber('TS_FALLBACK_TIMEOUT_MS', 2500),

  /**
   * Enable automatic Python fallback in TS mode
   *
   * When enabled (default), TS engine errors/timeouts trigger automatic
   * fallback to Python. When disabled, TS errors are propagated to client.
   *
   * @env TS_FALLBACK_ENABLED
   * @default true
   */
  tsFallbackEnabled: getEnvBoolean('TS_FALLBACK_ENABLED', true),

  /**
   * Path to the dataset JSON file for the TS search engine.
   *
   * The file should be generated by `backend/scripts/dump_dataset_for_ts.py`.
   * Relative paths are resolved from the repository root.
   *
   * @env DATASET_PATH
   * @default data/dataset_ts.json
   */
  datasetPath: getEnvString('DATASET_PATH', 'data/dataset_ts.json'),

  // ===========================================================================
  // Embedding Provider Configuration
  // ===========================================================================

  /**
   * Embedding provider mode
   *
   * - 'mock': Use stub provider (default, for tests/dev)
   * - 'openai': Use OpenAI embeddings API
   * - 'hf': Use Hugging Face Inference API
   * - 'none': Disable embeddings (throws on use)
   *
   * @env EMBEDDINGS_PROVIDER_MODE
   * @default mock
   */
  embeddingsProviderMode: getEnvEmbeddingsMode('EMBEDDINGS_PROVIDER_MODE'),

  // ===========================================================================
  // Cross-Encoder Provider Configuration
  // ===========================================================================

  /**
   * Cross-encoder provider mode
   *
   * - 'mock': Use stub provider (default, for tests/dev)
   * - 'hf': Use Hugging Face Inference API
   * - 'none': Disable cross-encoder (uses constant scores)
   *
   * @env CROSS_ENCODER_PROVIDER_MODE
   * @default mock
   */
  crossEncoderProviderMode: getEnvCrossEncoderMode('CROSS_ENCODER_PROVIDER_MODE'),

  // ===========================================================================
  // OpenAI Configuration
  // ===========================================================================

  /** OpenAI API key (required if embeddingsProviderMode === 'openai') */
  openaiApiKey: getEnvString('OPENAI_API_KEY', ''),

  /** OpenAI API base URL */
  openaiBaseUrl: getEnvString('OPENAI_BASE_URL', 'https://api.openai.com/v1'),

  /** OpenAI embeddings model */
  openaiEmbeddingsModel: getEnvString('OPENAI_EMBEDDINGS_MODEL', 'text-embedding-3-small'),

  // ===========================================================================
  // Hugging Face Configuration
  // ===========================================================================

  /** Hugging Face API key (required if using HF providers) */
  hfApiKey: getEnvString('HF_API_KEY', ''),

  /** Hugging Face Inference API base URL */
  hfApiUrl: getEnvString('HF_API_URL', 'https://api-inference.huggingface.co'),

  /** Hugging Face embeddings model (mirrors Python default) */
  hfEmbeddingsModel: getEnvString('HF_EMBEDDINGS_MODEL', 'sentence-transformers/all-MiniLM-L6-v2'),

  /** Hugging Face cross-encoder model (mirrors Python default) */
  hfCrossEncoderModel: getEnvString('HF_CROSS_ENCODER_MODEL', 'cross-encoder/ms-marco-MiniLM-L-6-v2'),

  // ===========================================================================
  // Generic Embedding Client Configuration (Low-Level HTTP)
  // ===========================================================================

  /**
   * Embedding provider type for embedding client factory
   * 
   * - 'local': Use LocalEmbeddingClient (DEFAULT - no HTTP, CPU-based, zero cost)
   * - 'openai': Use OpenAI embeddings API (HTTP, paid, high quality)
   * - 'azure': Use Azure OpenAI embeddings API (HTTP, paid, enterprise)
   * - 'custom': Use custom HTTP endpoint (OpenAI-compatible API format)
   * 
   * @env EMBEDDING_PROVIDER
   * @default local
   */
  embeddingProvider: getEnvEmbeddingProvider('EMBEDDING_PROVIDER'),

  /**
   * Embedding API key
   * 
   * Required for all embedding providers (OpenAI, Azure, custom).
   * 
   * @env EMBEDDING_API_KEY
   * @default empty string
   */
  embeddingApiKey: getEnvString('EMBEDDING_API_KEY', ''),

  /**
   * Embedding API base URL
   * 
   * Examples:
   * - OpenAI: https://api.openai.com/v1
   * - Azure: https://{resource}.openai.azure.com
   * - Custom: https://your-embedding-service.com/api
   * 
   * @env EMBEDDING_API_URL
   * @default https://api.openai.com/v1
   */
  embeddingApiUrl: getEnvString('EMBEDDING_API_URL', 'https://api.openai.com/v1'),

  /**
   * Embedding model name
   * 
   * Examples:
   * - OpenAI: text-embedding-3-small, text-embedding-3-large
   * - Azure: deployment name (e.g., 'text-embedding-ada-002')
   * - HuggingFace: sentence-transformers/all-MiniLM-L6-v2
   * 
   * @env EMBEDDING_MODEL_NAME
   * @default text-embedding-3-small
   */
  embeddingModelName: getEnvString('EMBEDDING_MODEL_NAME', 'text-embedding-3-small'),

  /**
   * Expected embedding dimension (for validation)
   * 
   * Common values:
   * - 384: sentence-transformers/all-MiniLM-L6-v2
   * - 768: BERT-based models
   * - 1536: OpenAI text-embedding-3-small, text-embedding-ada-002
   * - 3072: OpenAI text-embedding-3-large
   * 
   * @env EMBEDDING_DIMENSION
   * @default 1536
   */
  embeddingDimension: getEnvNumber('EMBEDDING_DIMENSION', 1536),

  // ===========================================================================
  // Azure OpenAI Configuration (only needed if EMBEDDING_PROVIDER=azure)
  // ===========================================================================

  /**
   * Azure OpenAI API version
   * 
   * @env AZURE_API_VERSION
   * @default 2023-05-15
   */
  azureApiVersion: getEnvString('AZURE_API_VERSION', '2023-05-15'),

  /**
   * Azure OpenAI deployment name
   * 
   * In Azure, you create a "deployment" for each model.
   * This is the deployment name, not the model name.
   * 
   * @env AZURE_DEPLOYMENT_NAME
   * @default empty string (will use EMBEDDING_MODEL_NAME if not set)
   */
  azureDeploymentName: getEnvString('AZURE_DEPLOYMENT_NAME', ''),

  // ===========================================================================
  // Request Limits (Resource Management)
  // ===========================================================================

  /**
   * Maximum top_k value allowed in search requests
   *
   * Prevents excessive memory/CPU usage from large result sets.
   * Requests with larger top_k will be clamped to this value.
   *
   * @env MAX_TOP_K
   * @default 50 (default profile), 30 (free_tier profile)
   */
  get maxTopK(): number {
    const envValue = getEnvNumber('MAX_TOP_K', 0)
    if (envValue > 0) return envValue
    return this.runtimeProfile === 'free_tier' ? 30 : 50
  },

  /**
   * Maximum number of queries in batch requests
   *
   * Prevents excessive load from large batch operations.
   * Requests with more queries will be rejected with 400.
   *
   * @env MAX_BATCH_SIZE
   * @default 50 (default profile), 20 (free_tier profile)
   */
  get maxBatchSize(): number {
    const envValue = getEnvNumber('MAX_BATCH_SIZE', 0)
    if (envValue > 0) return envValue
    return this.runtimeProfile === 'free_tier' ? 20 : 50
  },

  /**
   * Timeout for external provider API calls (embeddings, cross-encoder)
   *
   * Prevents hanging on slow/unavailable external APIs.
   *
   * @env PROVIDER_TIMEOUT_MS
   * @default 2000ms
   */
  providerTimeoutMs: getEnvNumber('PROVIDER_TIMEOUT_MS', 2000),
} as const

export type Config = typeof config
