// ⚠️ CORE SEARCH COMPONENT – NÃO REMOVER ESTE ARQUIVO
// Este é o WRAPPER de resiliência para o engine de busca TypeScript.
// Responsável por: execução de tsHybridEngine com fallback automático para Python em caso de erro/timeout.
// Dependências CORE: tsHybridEngine.ts (engine principal), pythonProxyEngine.ts (fallback).
// Usado por: searchEngineFactory (modo 'ts'), API routes (produção).

/**
 * SafeTsEngine - TypeScript engine with automatic Python fallback
 *
 * Design:
 * - TypeScript (TsHybridSearchEngine) is PRIMARY
 * - On TS error/timeout, automatically falls back to Python
 * - Logs fallback events for monitoring
 * - Sets metadata for HTTP headers (X-Search-Engine, X-Engine-Fallback)
 *
 * Purpose:
 * - Safe production deployment of TS engine
 * - Transparent degradation to Python when needed
 * - Zero client impact (same API, fallback is invisible)
 */

import type {
  SearchEngine,
  SearchParams,
  BatchSearchParams,
  SearchResult,
} from '../searchEngine.js'

// Logger interface (duck-typed from infra/logging)
export interface Logger {
  info(message: string, context?: Record<string, unknown>): void
  warn(message: string, context?: Record<string, unknown>): void
  error(message: string, context?: Record<string, unknown>): void
}

export interface TsFallbackConfig {
  /** Timeout in milliseconds for TS engine (default: 2500ms) */
  timeoutMs: number

  /** Enable automatic fallback to Python (default: true) */
  enableFallback: boolean

  /** Log level for fallback events (default: 'warn') */
  logLevel?: 'info' | 'warn' | 'error'
}

export interface EngineMetadata {
  /** Which engine was used for the result */
  engineUsed: 'ts' | 'python'

  /** Whether Python fallback was triggered */
  fallbackUsed: boolean

  /** Duration in milliseconds */
  durationMs: number

  /** Error that triggered fallback (if any) */
  fallbackReason?: string
}

/**
 * SafeTsEngine wraps TsHybridSearchEngine with automatic Python fallback
 */
export class SafeTsEngine implements SearchEngine {
  readonly name = 'SafeTsEngine'

  private fallbackCount = 0
  private timeoutCount = 0
  private errorCount = 0

  constructor(
    private readonly tsEngine: SearchEngine,
    private readonly pythonEngine: SearchEngine,
    private readonly logger: Logger,
    private readonly fallbackConfig: TsFallbackConfig
  ) {}

  async isReady(): Promise<boolean> {
    // Both engines should be ready, but TS is primary
    const [tsReady, pythonReady] = await Promise.all([
      this.tsEngine.isReady(),
      this.pythonEngine.isReady(),
    ])

    if (!tsReady) {
      this.logger.warn('[SafeTsEngine] TS engine not ready')
    }
    if (!pythonReady) {
      this.logger.warn('[SafeTsEngine] Python fallback not ready')
    }

    // At least TS should be ready for normal operation
    return tsReady
  }

  async smartSearch(params: SearchParams): Promise<SearchResult> {
    const start = performance.now()

    try {
      // Try TS engine with timeout
      const result = await this.runWithTimeout(
        () => this.tsEngine.smartSearch(params),
        this.fallbackConfig.timeoutMs
      )

      const duration = performance.now() - start

      this.logger.info('[SafeTsEngine] TS engine success', {
        query: params.descricao.slice(0, 50),
        durationMs: Math.round(duration),
        resultCount: result.total,
      })

      // Attach metadata for HTTP headers
      return this.withEngineMetadata(result, {
        engineUsed: 'ts',
        fallbackUsed: false,
        durationMs: Math.round(duration),
      })
    } catch (err) {
      const tsDuration = performance.now() - start
      const isTimeout = err instanceof TimeoutError
      const errorMessage = err instanceof Error ? err.message : String(err)

      // Update metrics
      this.fallbackCount++
      if (isTimeout) {
        this.timeoutCount++
      } else {
        this.errorCount++
      }

      // Log TS failure
      const logLevel = this.fallbackConfig.logLevel ?? 'warn'
      this.logger[logLevel]('[SafeTsEngine] TS engine failed', {
        query: params.descricao.slice(0, 50),
        error: errorMessage,
        isTimeout,
        durationMs: Math.round(tsDuration),
        fallbackEnabled: this.fallbackConfig.enableFallback,
        stats: {
          fallbackCount: this.fallbackCount,
          timeoutCount: this.timeoutCount,
          errorCount: this.errorCount,
        },
      })

      // If fallback disabled, rethrow
      if (!this.fallbackConfig.enableFallback) {
        throw err
      }

      // Fallback to Python
      const pythonStart = performance.now()
      try {
        const pythonResult = await this.pythonEngine.smartSearch(params)
        const pythonDuration = performance.now() - pythonStart

        this.logger.info('[SafeTsEngine] Python fallback success', {
          query: params.descricao.slice(0, 50),
          pythonDurationMs: Math.round(pythonDuration),
          totalDurationMs: Math.round(performance.now() - start),
          resultCount: pythonResult.total,
        })

        // Attach metadata indicating fallback was used
        return this.withEngineMetadata(pythonResult, {
          engineUsed: 'python',
          fallbackUsed: true,
          durationMs: Math.round(pythonDuration),
          fallbackReason: isTimeout ? 'timeout' : 'error',
        })
      } catch (pythonErr) {
        // Both engines failed - this is critical
        this.logger.error('[SafeTsEngine] Both TS and Python engines failed', {
          query: params.descricao.slice(0, 50),
          tsError: errorMessage,
          pythonError: pythonErr instanceof Error ? pythonErr.message : String(pythonErr),
        })
        throw pythonErr
      }
    }
  }

  async smartSearchBatch(params: BatchSearchParams): Promise<SearchResult[]> {
    // For batch operations, use the same fallback logic
    const start = performance.now()

    try {
      const results = await this.runWithTimeout(
        () => this.tsEngine.smartSearchBatch(params),
        this.fallbackConfig.timeoutMs * params.descricoes.length // Scale timeout by batch size
      )

      const duration = performance.now() - start

      this.logger.info('[SafeTsEngine] TS batch success', {
        queryCount: params.descricoes.length,
        durationMs: Math.round(duration),
      })

      // Attach metadata to all results
      return results.map((result) =>
        this.withEngineMetadata(result, {
          engineUsed: 'ts',
          fallbackUsed: false,
          durationMs: Math.round(duration / params.descricoes.length),
        })
      )
    } catch (err) {
      const isTimeout = err instanceof TimeoutError
      const errorMessage = err instanceof Error ? err.message : String(err)

      this.fallbackCount++
      if (isTimeout) {
        this.timeoutCount++
      } else {
        this.errorCount++
      }

      const logLevel = this.fallbackConfig.logLevel ?? 'warn'
      this.logger[logLevel]('[SafeTsEngine] TS batch failed', {
        queryCount: params.descricoes.length,
        error: errorMessage,
        isTimeout,
      })

      if (!this.fallbackConfig.enableFallback) {
        throw err
      }

      // Fallback to Python
      const pythonStart = performance.now()
      const pythonResults = await this.pythonEngine.smartSearchBatch(params)
      const pythonDuration = performance.now() - pythonStart

      this.logger.info('[SafeTsEngine] Python batch fallback success', {
        queryCount: params.descricoes.length,
        pythonDurationMs: Math.round(pythonDuration),
      })

      return pythonResults.map((result) =>
        this.withEngineMetadata(result, {
          engineUsed: 'python',
          fallbackUsed: true,
          durationMs: Math.round(pythonDuration / params.descricoes.length),
          fallbackReason: isTimeout ? 'timeout' : 'error',
        })
      )
    }
  }

  /**
   * Get fallback statistics (for monitoring/metrics)
   */
  getStats() {
    return {
      fallbackCount: this.fallbackCount,
      timeoutCount: this.timeoutCount,
      errorCount: this.errorCount,
    }
  }

  /**
   * Reset statistics (useful for testing)
   */
  resetStats() {
    this.fallbackCount = 0
    this.timeoutCount = 0
    this.errorCount = 0
  }

  /**
   * Run a promise with timeout
   */
  private async runWithTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) => {
        setTimeout(() => reject(new TimeoutError(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
      }),
    ])
  }

  /**
   * Attach engine metadata to result (for HTTP headers)
   */
  private withEngineMetadata(result: SearchResult, metadata: EngineMetadata): SearchResult {
    // Attach metadata to debug field (if it exists) or create it
    return {
      ...result,
      debug: {
        timings: result.debug?.timings ?? [],
        queryDomain: result.debug?.queryDomain,
        topDomainStats: result.debug?.topDomainStats,
        engineMetadata: metadata,
      },
    }
  }
}

/**
 * Custom error for timeout detection
 */
export class TimeoutError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TimeoutError'
  }
}
