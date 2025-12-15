/**
 * 🔴 DEPRECATED – CÓDIGO LEGADO
 * 
 * Este módulo está obsoleto após migração completa para TypeScript.
 * 
 * SUBSTITUÍDO POR: TsHybridEngine (src/domain/engines/tsHybridEngine.ts)
 * RAZÃO: Busca nativa em TypeScript elimina dependência do backend Python
 * STATUS: Preservado para referência histórica, não usar em código novo
 * DATA: Janeiro 2025
 * 
 * ============================================================================
 * 
 * Python Proxy Search Engine
 *
 * Encapsulates the existing proxy behavior into a SearchEngine implementation.
 * This is the safe fallback engine that delegates all work to Python.
 */

import { callPythonApi } from '../../infra/httpClient.js'
import { logger } from '../../infra/logging.js'
import type {
  SearchEngine,
  SearchParams,
  BatchSearchParams,
  SearchResult,
} from '../searchEngine.js'
import type { SmartSearchResponse, BatchSmartSearchResponse } from '../searchContracts.js'

/**
 * Python Proxy Search Engine
 *
 * Delegates all search operations to the Python backend.
 * This is the default engine and the safe fallback for error recovery.
 */
export class PythonProxySearchEngine implements SearchEngine {
  readonly name = 'python-proxy'

  async smartSearch(params: SearchParams): Promise<SearchResult> {
    logger.debug(`[${this.name}] smartSearch called`, { query: params.descricao })

    try {
      const response = await callPythonApi<SearchParams, SmartSearchResponse>(
        'POST',
        '/buscar-inteligente',
        {
          descricao: params.descricao,
          top_k: params.top_k,
          min_score: params.min_score,
          use_tfidf: params.use_tfidf,
        }
      )

      return this.convertResponse(response)
    } catch (error) {
      logger.error(`[${this.name}] smartSearch failed`, {
        error: error instanceof Error ? error.message : String(error),
        query: params.descricao,
      })
      throw error
    }
  }

  async smartSearchBatch(params: BatchSearchParams): Promise<SearchResult[]> {
    logger.debug(`[${this.name}] smartSearchBatch called`, {
      queryCount: params.descricoes.length,
    })

    try {
      const response = await callPythonApi<BatchSearchParams, BatchSmartSearchResponse>(
        'POST',
        '/buscar-lote-inteligente',
        {
          descricoes: params.descricoes,
          top_k: params.top_k,
          use_tfidf: params.use_tfidf,
        }
      )

      return response.resultados.map((r) => this.convertResponse(r))
    } catch (error) {
      logger.error(`[${this.name}] smartSearchBatch failed`, {
        error: error instanceof Error ? error.message : String(error),
        queryCount: params.descricoes.length,
      })
      throw error
    }
  }

  async isReady(): Promise<boolean> {
    try {
      // Check Python backend health
      await callPythonApi<never, { status: string }>('GET', '/health')
      return true
    } catch {
      return false
    }
  }

  /**
   * Convert Python API response to internal SearchResult type
   */
  private convertResponse(response: SmartSearchResponse): SearchResult {
    return {
      query_original: response.query_original,
      query_normalizada: response.query_normalizada,
      consonant_key: response.consonant_key,
      expansoes_detectadas: response.expansoes_detectadas,
      modelo_semantico: response.modelo_semantico,
      modelo_reranker: response.modelo_reranker,
      resultados: response.resultados.map((r) => ({
        grupo: r.grupo,
        descricao: r.descricao,
        score: r.score,
        score_normalized: r.score_normalized,
        score_breakdown: r.score_breakdown,
        sugeridos: r.sugeridos,
      })),
      total: response.total,
      fallback: response.fallback,
      fallback_reason: response.fallback_reason,
    }
  }
}

/**
 * Create a Python proxy search engine instance
 */
export function createPythonProxyEngine(): PythonProxySearchEngine {
  return new PythonProxySearchEngine()
}
