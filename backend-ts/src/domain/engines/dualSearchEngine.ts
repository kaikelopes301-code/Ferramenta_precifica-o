/**
 * 🔴 DEPRECATED – CÓDIGO LEGADO
 * 
 * Este módulo está obsoleto após migração completa para TypeScript.
 * 
 * RAZÃO: TsHybridEngine é agora a implementação primária, Python proxy não é mais necessário
 * STATUS: Preservado para referência histórica, não usar em código novo
 * DATA: Janeiro 2025
 * 
 * ============================================================================
 * 
 * DualSearchEngine - Executa Python e TS em paralelo para validação
 *
 * Design:
 * - Executa AMBOS os engines (Python proxy + TS nativo) para a mesma query
 * - Python continua sendo autoritativo (response final vem do Python)
 * - Compara os resultados e loga diferenças (observability)
 * - Implementa sampling via DUAL_SAMPLE_RATE (0.0-1.0)
 * - Coleta métricas de timing de ambos os engines
 *
 * Propósito:
 * - Quality gate antes do cutover completo para TS
 * - Detectar regressões/diferenças entre implementações
 * - Monitorar performance comparativa
 */

import type {
  SearchEngine,
  SearchParams,
  BatchSearchParams,
  SearchResult,
} from '../searchEngine.js'
import type {
  SearchResultComparator,
  DetailedComparison,
} from '../searchResultComparator.js'
import { DefaultSearchResultComparator } from '../searchResultComparator.js'

export interface DualSearchEngineConfig {
  /** Engine Python (autoritativo) */
  pythonEngine: SearchEngine

  /** Engine TypeScript (validação) */
  tsEngine: SearchEngine

  /** Taxa de amostragem (0.0-1.0, default: 0.1 = 10%) */
  sampleRate?: number

  /** Comparator (opcional, cria um padrão se não fornecido) */
  comparator?: SearchResultComparator

  /** Callback para logging de comparações */
  onComparison?: (comparison: DetailedComparison) => void
}

export class DualSearchEngine implements SearchEngine {
  private readonly pythonEngine: SearchEngine
  private readonly tsEngine: SearchEngine
  private readonly sampleRate: number
  private readonly comparator: SearchResultComparator
  private readonly onComparison?: (comparison: DetailedComparison) => void

  readonly name = 'DualSearchEngine'

  constructor(config: DualSearchEngineConfig) {
    this.pythonEngine = config.pythonEngine
    this.tsEngine = config.tsEngine
    this.sampleRate = config.sampleRate ?? 0.1
    this.comparator = config.comparator ?? new DefaultSearchResultComparator()
    this.onComparison = config.onComparison
  }

  async isReady(): Promise<boolean> {
    // Ambos os engines devem estar prontos
    const [pythonReady, tsReady] = await Promise.all([
      this.pythonEngine.isReady(),
      this.tsEngine.isReady(),
    ])
    return pythonReady && tsReady
  }

  async smartSearch(params: SearchParams): Promise<SearchResult> {
    // Decidir se devemos executar dual mode (sampling)
    const shouldCompare = Math.random() < this.sampleRate

    if (!shouldCompare) {
      // Apenas Python (modo normal)
      return this.pythonEngine.smartSearch(params)
    }

    // Dual mode: executar ambos em paralelo
    const [pythonResult, tsResult] = await Promise.all([
      this.pythonEngine.smartSearch(params),
      this.tsEngine.smartSearch(params),
    ])

    // Comparar resultados e logar
    try {
      const comparison = this.comparator.createDetailedComparison(
        params.descricao,
        pythonResult,
        tsResult
      )

      // Callback para logging externo
      if (this.onComparison) {
        this.onComparison(comparison)
      }

      // Logar no console se houver diferenças significativas
      if (!this.comparator.isWithinThreshold(comparison.metrics)) {
        console.warn('[DualSearchEngine] Significant difference detected:', {
          query: params.descricao,
          jaccardSimilarity: comparison.metrics.jaccardSimilarity,
          rankDifference: comparison.metrics.rankDifference,
          scoreMae: comparison.metrics.scoreMae,
          pythonOnlyCount: comparison.metrics.pythonOnlyIds.length,
          tsOnlyCount: comparison.metrics.tsOnlyIds.length,
        })
      }
    } catch (error) {
      // Não falhar a request se a comparação der erro
      console.error('[DualSearchEngine] Error comparing results:', error)
    }

    // Python é autoritativo - retornar resultado dele
    return pythonResult
  }

  async smartSearchBatch(params: BatchSearchParams): Promise<SearchResult[]> {
    // Para batch, sempre usar apenas Python (evitar overhead excessivo)
    // Se quisermos sampling em batch, podemos implementar posteriormente
    return this.pythonEngine.smartSearchBatch(params)
  }
}
