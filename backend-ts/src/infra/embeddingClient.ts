/**
 * Embedding Client Infrastructure
 * 
 * Provides HTTP client for calling external embedding APIs (OpenAI, Azure, HuggingFace, etc.)
 * This is the low-level HTTP layer - higher-level providers wrap this with specific API formats.
 * 
 * Architecture:
 * - EmbeddingClient: Interface for text → vector conversion
 * - HttpEmbeddingClient: Generic HTTP implementation
 * - OpenAIEmbeddingClient: OpenAI-specific implementation
 * - AzureEmbeddingClient: Azure OpenAI-specific implementation (future)
 * 
 * Usage:
 * ```typescript
 * const client = new OpenAIEmbeddingClient({
 *   apiKey: config.embeddingApiKey,
 *   baseUrl: config.embeddingApiUrl,
 *   modelName: config.embeddingModelName
 * });
 * 
 * const vector = await client.embed("text to embed");
 * // vector: number[] (e.g., 1536 dimensions for text-embedding-3-small)
 * ```
 */

import { request } from 'undici';
import { logger } from './logging.js';
import { config } from '../config/env.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Core embedding client interface
 * All embedding clients must implement this interface
 */
export interface EmbeddingClient {
  /**
   * Convert text to embedding vector
   * 
   * @param text - Input text to embed
   * @returns Promise resolving to embedding vector (array of floats)
   * @throws Error if API call fails or returns invalid response
   */
  embed(text: string): Promise<number[]>;

  /**
   * Convert multiple texts to embedding vectors (batch operation)
   * 
   * @param texts - Array of input texts to embed
   * @returns Promise resolving to array of embedding vectors
   * @throws Error if API call fails or returns invalid response
   */
  embedBatch(texts: string[]): Promise<number[][]>;

  /**
   * Get the dimension of the embeddings produced by this client
   */
  readonly dimension: number;

  /**
   * Get the model name used by this client
   */
  readonly modelName: string;
}

/**
 * Configuration for HTTP-based embedding clients
 */
export interface EmbeddingClientConfig {
  /** API key for authentication */
  apiKey: string;

  /** Base URL of the embedding API */
  baseUrl: string;

  /** Model name/identifier */
  modelName: string;

  /** Expected dimension of embeddings (for validation) */
  dimension?: number;

  /** Request timeout in milliseconds (default: 10000) */
  timeoutMs?: number;

  /** Maximum retries on failure (default: 2) */
  maxRetries?: number;

  /** Custom headers to include in requests */
  headers?: Record<string, string>;
}

// =============================================================================
// Generic HTTP Embedding Client
// =============================================================================

/**
 * Generic HTTP-based embedding client
 * 
 * This is a flexible base implementation that can be subclassed
 * for specific API formats (OpenAI, Azure, HuggingFace, etc.)
 */
export abstract class HttpEmbeddingClient implements EmbeddingClient {
  protected readonly apiKey: string;
  protected readonly baseUrl: string;
  public readonly modelName: string;
  public readonly dimension: number;
  protected readonly timeoutMs: number;
  protected readonly maxRetries: number;
  protected readonly customHeaders: Record<string, string>;

  constructor(config: EmbeddingClientConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.modelName = config.modelName;
    this.dimension = config.dimension || 1536; // Default for OpenAI text-embedding-3-small
    this.timeoutMs = config.timeoutMs || 10000;
    this.maxRetries = config.maxRetries || 2;
    this.customHeaders = config.headers || {};

    if (!this.apiKey) {
      throw new Error('EmbeddingClient: API key is required');
    }
    if (!this.baseUrl) {
      throw new Error('EmbeddingClient: Base URL is required');
    }
    if (!this.modelName) {
      throw new Error('EmbeddingClient: Model name is required');
    }
  }

  /**
   * Build the request payload for the embedding API
   * Subclasses override this to match their API format
   */
  protected abstract buildRequestPayload(texts: string[]): unknown;

  /**
   * Extract embeddings from the API response
   * Subclasses override this to match their API format
   */
  protected abstract extractEmbeddings(response: unknown): number[][];

  /**
   * Get the API endpoint URL
   * Subclasses can override to customize the endpoint
   */
  protected getEndpoint(): string {
    return `${this.baseUrl}/embeddings`;
  }

  /**
   * Get request headers
   * Subclasses can override to customize headers
   */
  protected getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
      ...this.customHeaders
    };
  }

  /**
   * Make HTTP request to embedding API with retries
   */
  protected async makeRequest(texts: string[], attempt: number = 1): Promise<number[][]> {
    const payload = this.buildRequestPayload(texts);
    const endpoint = this.getEndpoint();

    try {
      logger.debug('[EmbeddingClient] Making request', JSON.stringify({
        endpoint,
        textCount: texts.length,
        attempt,
        model: this.modelName
      }));

      const startTime = Date.now();

      const response = await request(endpoint, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
        bodyTimeout: this.timeoutMs,
        headersTimeout: this.timeoutMs
      });

      const duration = Date.now() - startTime;

      if (response.statusCode !== 200) {
        const errorText = await response.body.text();
        throw new Error(
          `EmbeddingClient: API returned ${response.statusCode}: ${errorText}`
        );
      }

      const responseData = await response.body.json();
      const embeddings = this.extractEmbeddings(responseData);

      logger.debug('[EmbeddingClient] Request successful', JSON.stringify({
        duration,
        embeddingsCount: embeddings.length,
        dimension: embeddings[0]?.length
      }));

      // Validate dimensions
      for (const embedding of embeddings) {
        if (embedding.length !== this.dimension) {
          logger.warn('[EmbeddingClient] Dimension mismatch', JSON.stringify({
            expected: this.dimension,
            received: embedding.length
          }));
        }
      }

      return embeddings;

    } catch (error) {
      logger.error('[EmbeddingClient] Request failed', JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
        attempt,
        maxRetries: this.maxRetries
      }));

      // Retry logic
      if (attempt < this.maxRetries) {
        const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        logger.info(`[EmbeddingClient] Retrying in ${backoffMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
        return this.makeRequest(texts, attempt + 1);
      }

      throw error;
    }
  }

  /**
   * Embed a single text
   */
  async embed(text: string): Promise<number[]> {
    const embeddings = await this.embedBatch([text]);
    return embeddings[0]!;
  }

  /**
   * Embed multiple texts in a single request
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    return this.makeRequest(texts);
  }
}

// =============================================================================
// OpenAI-specific Implementation
// =============================================================================

/**
 * OpenAI Embeddings API client
 * 
 * Supports:
 * - text-embedding-3-small (1536 dimensions, $0.02/1M tokens)
 * - text-embedding-3-large (3072 dimensions, $0.13/1M tokens)
 * - text-embedding-ada-002 (1536 dimensions, legacy)
 * 
 * API Docs: https://platform.openai.com/docs/api-reference/embeddings
 */
export class OpenAIEmbeddingClient extends HttpEmbeddingClient {
  constructor(config: Omit<EmbeddingClientConfig, 'dimension'> & { dimension?: number }) {
    super({
      ...config,
      dimension: config.dimension || 1536 // Default for text-embedding-3-small
    });
  }

  protected buildRequestPayload(texts: string[]): unknown {
    return {
      model: this.modelName,
      input: texts,
      encoding_format: 'float' // Return floats instead of base64
    };
  }

  protected extractEmbeddings(response: any): number[][] {
    if (!response.data || !Array.isArray(response.data)) {
      throw new Error('OpenAIEmbeddingClient: Invalid response format (missing data array)');
    }

    // Sort by index to ensure correct order
    const sortedData = [...response.data].sort((a, b) => a.index - b.index);

    return sortedData.map((item: any) => {
      if (!item.embedding || !Array.isArray(item.embedding)) {
        throw new Error('OpenAIEmbeddingClient: Invalid embedding in response');
      }
      return item.embedding;
    });
  }
}

// =============================================================================
// Azure OpenAI-specific Implementation
// =============================================================================

/**
 * Azure OpenAI Embeddings API client
 * 
 * Uses Azure-specific authentication and endpoint format.
 * Endpoint format: https://{resource}.openai.azure.com/openai/deployments/{deployment}/embeddings?api-version=2023-05-15
 */
export class AzureEmbeddingClient extends HttpEmbeddingClient {
  private readonly apiVersion: string;
  private readonly deploymentName: string;

  constructor(
    config: Omit<EmbeddingClientConfig, 'dimension'> & {
      dimension?: number;
      apiVersion?: string;
      deploymentName?: string;
    }
  ) {
    super({
      ...config,
      dimension: config.dimension || 1536
    });

    this.apiVersion = config.apiVersion || '2023-05-15';
    this.deploymentName = config.deploymentName || config.modelName;
  }

  protected getEndpoint(): string {
    return `${this.baseUrl}/openai/deployments/${this.deploymentName}/embeddings?api-version=${this.apiVersion}`;
  }

  protected getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'api-key': this.apiKey, // Azure uses 'api-key' instead of 'Authorization'
      ...this.customHeaders
    };
  }

  protected buildRequestPayload(texts: string[]): unknown {
    return {
      input: texts
    };
  }

  protected extractEmbeddings(response: any): number[][] {
    if (!response.data || !Array.isArray(response.data)) {
      throw new Error('AzureEmbeddingClient: Invalid response format (missing data array)');
    }

    const sortedData = [...response.data].sort((a, b) => a.index - b.index);

    return sortedData.map((item: any) => {
      if (!item.embedding || !Array.isArray(item.embedding)) {
        throw new Error('AzureEmbeddingClient: Invalid embedding in response');
      }
      return item.embedding;
    });
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create an embedding client from environment configuration
 * 
 * Reads from:
 * - EMBEDDING_PROVIDER: 'local' | 'openai' | 'azure' | 'custom' (default: 'local')
 * - EMBEDDING_API_KEY (only for HTTP providers)
 * - EMBEDDING_API_URL (only for HTTP providers)
 * - EMBEDDING_MODEL_NAME (only for HTTP providers)
 * - EMBEDDING_DIMENSION (optional)
 */
export async function createEmbeddingClientFromEnv(): Promise<EmbeddingClient> {
  const provider = config.embeddingProvider;

  switch (provider) {
    case 'openai':
      return new OpenAIEmbeddingClient({
        apiKey: config.embeddingApiKey,
        baseUrl: config.embeddingApiUrl,
        modelName: config.embeddingModelName,
        dimension: config.embeddingDimension || 1536,
        timeoutMs: config.providerTimeoutMs
      });

    case 'azure':
      return new AzureEmbeddingClient({
        apiKey: config.embeddingApiKey,
        baseUrl: config.embeddingApiUrl,
        modelName: config.embeddingModelName,
        dimension: config.embeddingDimension || 1536,
        timeoutMs: config.providerTimeoutMs,
        apiVersion: config.azureApiVersion,
        deploymentName: config.azureDeploymentName
      });

    case 'custom':
      // Custom HTTP provider (generic OpenAI-compatible API)
      return new OpenAIEmbeddingClient({
        apiKey: config.embeddingApiKey,
        baseUrl: config.embeddingApiUrl,
        modelName: config.embeddingModelName,
        dimension: config.embeddingDimension || 1536,
        timeoutMs: config.providerTimeoutMs
      });

    case 'local':
    default:
      // Default to local embeddings (no HTTP, no Python, runs on CPU)
      // If provider is unknown, log warning and fallback to local
      if (provider !== 'local') {
        console.warn(
          `[EmbeddingClient] Unknown provider "${provider}", falling back to 'local'. ` +
          `Valid options: 'local', 'openai', 'azure', 'custom'.`
        );
      }
      // Dynamic import to avoid circular deps and ES module issues
      const { LocalEmbeddingClient } = await import('./localEmbeddingClient.js');
      return new LocalEmbeddingClient();
  }
}
