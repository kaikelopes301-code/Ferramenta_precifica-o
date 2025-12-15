// ⚠️ CORE SEARCH COMPONENT – NÃO REMOVER ESTE ARQUIVO
// Este é o ENGINE PRINCIPAL de busca TypeScript (pipeline completo).
// Responsável por: orquestração de TF-IDF + Semantic Reranking + Numeric Boost.
// Dependências CORE: tfidf.ts, semanticReranker.ts, attributes.ts, normalization.ts, domainClassification.ts.
// Usado por: safeTsEngine (wrapper com fallback), dualSearchEngine (comparação).

/**
 * TypeScript Hybrid Search Engine
 *
 * Native TS implementation that combines:
 * 1. TF-IDF lexical search (HybridTfidfSearchIndex)
 * 2. Semantic reranking (createSemanticReranker)
 * 3. Numeric attribute boosting
 *
 * Score formula: final = 0.7×semantic + 0.2×reranker + 0.1×numeric_boost
 */

import { logger } from '../../infra/logging.js'
import type {
  SearchEngine,
  SearchParams,
  BatchSearchParams,
  SearchResult,
  SearchResultItem,
  CorpusDocument,
  CorpusRepository,
  DomainStats,
} from '../searchEngine.js'
import { HybridTfidfSearchIndex } from '../tfidf.js'
import {
  createSemanticReranker,
  SemanticReranker,
  EmbeddingProvider,
  CrossEncoderProvider,
  CandidateInput,
  DEFAULT_SEMANTIC_MODEL,
  DEFAULT_RERANKER_MODEL,
} from '../semanticReranker.js'
import { normalizeEquip, consonantSignature, expansionVariantsForQuery } from '../normalization.js'
import { extractAllAttributes } from '../attributes.js'
import { classifyQuery, computeDomainScore } from '../domainClassification.js'
import { createTimingCollector, type TimingCollector } from '../../utils/timing.js'
import type { SemanticSearchService } from '../semanticSearchService.js'

// =============================================================================
// Configuration
// =============================================================================

export interface TsHybridEngineConfig {
  /** Maximum TF-IDF candidates to pass to reranker */
  tfidfTopK?: number
  /** Maximum final results to return */
  defaultTopK?: number
  /** Minimum score to include in results */
  defaultMinScore?: number
  /** TF-IDF weight in initial ranking (not in final score) */
  tfidfWeight?: number
  /** Fallback to Python on error */
  fallbackOnError?: boolean
  /** Enable debug info collection (timings, domain stats) */
  enableDebugInfo?: boolean
}

const DEFAULT_CONFIG: Required<TsHybridEngineConfig> = {
  tfidfTopK: 50,      // Get more candidates for reranking
  defaultTopK: 10,
  defaultMinScore: 0.0,
  tfidfWeight: 0.3,   // TF-IDF as initial filter only
  fallbackOnError: true,
  enableDebugInfo: false, // Disabled by default for performance
}

// =============================================================================
// TsHybridSearchEngine Implementation
// =============================================================================

/**
 * TypeScript Hybrid Search Engine
 *
 * Pipeline:
 * 1. TF-IDF retrieval (HybridTfidfSearchIndex) - get top N candidates
 * 2. Semantic reranking (embeddings + cross-encoder) - refine scores
 * 3. Numeric attribute boosting - adjust for matching specs
 * 4. Return top-k results with score breakdown
 */
export class TsHybridSearchEngine implements SearchEngine {
  readonly name = 'ts-hybrid'

  private tfidfIndex: HybridTfidfSearchIndex | null = null
  private reranker: SemanticReranker | null = null
  private corpus: Map<string, CorpusDocument> = new Map()
  private isInitialized = false
  private initPromise: Promise<void> | null = null
  private readonly config: Required<TsHybridEngineConfig>
  private readonly semanticSearchService: SemanticSearchService | null

  constructor(
    private readonly corpusRepository: CorpusRepository,
    private readonly embeddingProvider: EmbeddingProvider,
    private readonly crossEncoderProvider: CrossEncoderProvider,
    config: TsHybridEngineConfig = {},
    semanticSearchService?: SemanticSearchService
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.semanticSearchService = semanticSearchService ?? null
  }

  /**
   * Initialize the search engine (build indices, load models)
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return
    if (this.initPromise) return this.initPromise

    this.initPromise = this.doInitialize()
    return this.initPromise
  }

  private async doInitialize(): Promise<void> {
    logger.info(`[${this.name}] Initializing...`)
    const startTime = Date.now()

    try {
      // Load corpus
      const documents = await this.corpusRepository.getAllDocuments()
      logger.info(`[${this.name}] Loaded ${documents.length} documents`)

      // Build corpus map
      for (const doc of documents) {
        this.corpus.set(doc.id, doc)
      }

      // Build TF-IDF index
      const tfidfDocs = documents.map((doc) => ({
        id: doc.id,
        text: doc.text,
      }))
      this.tfidfIndex = HybridTfidfSearchIndex.build(tfidfDocs)

      // Create semantic reranker
      this.reranker = createSemanticReranker(
        this.embeddingProvider,
        this.crossEncoderProvider
      )

      this.isInitialized = true
      const duration = Date.now() - startTime
      logger.info(`[${this.name}] Initialized in ${duration}ms`)
    } catch (error) {
      this.initPromise = null
      logger.error(`[${this.name}] Initialization failed`, {
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  async smartSearch(params: SearchParams): Promise<SearchResult> {
    const timing: TimingCollector = this.config.enableDebugInfo
      ? createTimingCollector()
      : { start: () => {}, end: () => {}, getTimings: () => [], reset: () => {} }

    timing.start('total')
    timing.start('initialize')
    await this.initialize()
    timing.end('initialize')

    const query = params.descricao
    const topK = params.top_k ?? this.config.defaultTopK
    const minScore = params.min_score ?? this.config.defaultMinScore

    logger.debug(`[${this.name}] smartSearch`, { query, topK })

    // Step 1: Normalize query and classify domain
    timing.start('normalize_query')
    const queryNormalized = normalizeEquip(query)
    const consonantKey = consonantSignature(queryNormalized)
    const expansions = expansionVariantsForQuery(query)
    timing.end('normalize_query')

    timing.start('domain_classification_query')
    const queryDomain = classifyQuery(query)
    timing.end('domain_classification_query')

    logger.debug(`[${this.name}] Query domain`, {
      category: queryDomain.category,
      confidence: queryDomain.confidence,
    })

    // Step 2: TF-IDF retrieval
    if (!this.tfidfIndex) {
      throw new Error('TF-IDF index not initialized')
    }

    timing.start('tfidf_search')
    const tfidfResults = this.tfidfIndex.search(queryNormalized, this.config.tfidfTopK)
    timing.end('tfidf_search')

    if (tfidfResults.length === 0) {
      timing.end('total')
      return this.emptyResult(query, queryNormalized, consonantKey, expansions, timing, queryDomain)
    }

    // Step 3: Prepare candidates for reranking
    timing.start('prepare_candidates')
    const candidates: CandidateInput[] = tfidfResults.map((r) => {
      const doc = this.corpus.get(r.id)
      return {
        id: r.id,
        text: doc?.text ?? r.id,
        lexicalScore: r.score,
        attributes: doc ? extractAllAttributes(doc.text) : undefined,
      }
    })
    timing.end('prepare_candidates')

    // Step 4: Semantic reranking (gets semantic + reranker scores)
    if (!this.reranker) {
      throw new Error('Reranker not initialized')
    }

    timing.start('semantic_rerank')
    const rerankedResults = await this.reranker.rerank(query, candidates)
    timing.end('semantic_rerank')

    // Step 5: Compute domain scores and recombine with new weights
    timing.start('domain_scoring')
    // New formula: combined = 0.25×tfidf + 0.40×semantic + 0.20×reranker + 0.15×domain
    const WEIGHT_TFIDF = 0.25
    const WEIGHT_SEMANTIC = 0.40
    const WEIGHT_RERANKER = 0.20
    const WEIGHT_DOMAIN = 0.15

    interface ScoredResult {
      id: string
      tfidfScore: number
      semanticScore: number
      rerankerScore: number
      domainScore: number
      combinedScore: number
    }

    const scoredResults: ScoredResult[] = rerankedResults.map((r) => {
      const doc = this.corpus.get(r.id)
      const docDomain = doc?.domain ?? { category: 'unknown' as const, confidence: 0.3 }

      const domainScore = computeDomainScore({
        queryDomain,
        docDomain,
      })

      const tfidfScore = candidates.find((c) => c.id === r.id)?.lexicalScore ?? 0

      // Recalculate combined score with domain component
      const combinedScore =
        WEIGHT_TFIDF * tfidfScore +
        WEIGHT_SEMANTIC * r.semanticScore +
        WEIGHT_RERANKER * r.rerankerScore +
        WEIGHT_DOMAIN * domainScore

      return {
        id: r.id,
        tfidfScore,
        semanticScore: r.semanticScore,
        rerankerScore: r.rerankerScore,
        domainScore,
        combinedScore,
      }
    })
    timing.end('domain_scoring')

    // Step 6: Sort by new combined score and format results
    timing.start('final_scoring')
    scoredResults.sort((a, b) => b.combinedScore - a.combinedScore)

    const resultItems: SearchResultItem[] = []
    for (const scored of scoredResults.slice(0, topK)) {
      if (scored.combinedScore < minScore) continue

      const doc = this.corpus.get(scored.id)
      const sugeridos = await this.corpusRepository.getSugestoes(scored.id)

      resultItems.push({
        grupo: scored.id,
        descricao: doc?.text ?? scored.id,
        score: scored.combinedScore,
        score_normalized: scored.combinedScore, // Already 0-1
        score_breakdown: {
          tfidf: scored.tfidfScore,
          semantic: scored.semanticScore,
          reranker: scored.rerankerScore,
          domain: scored.domainScore,
          combined: scored.combinedScore,
        },
        sugeridos,
      })
    }
    timing.end('final_scoring')
    timing.end('total')

    // Compute domain statistics for top results
    const topDomainStats = this.computeDomainStats(resultItems)

    const result: SearchResult = {
      query_original: query,
      query_normalizada: queryNormalized,
      consonant_key: consonantKey,
      expansoes_detectadas: expansions,
      modelo_semantico: DEFAULT_SEMANTIC_MODEL,
      modelo_reranker: DEFAULT_RERANKER_MODEL,
      resultados: resultItems,
      total: resultItems.length,
    }

    // Add debug info if enabled
    if (this.config.enableDebugInfo) {
      result.debug = {
        timings: timing.getTimings(),
        queryDomain,
        topDomainStats,
      }
    }

    return result
  }

  async smartSearchBatch(params: BatchSearchParams): Promise<SearchResult[]> {
    // Process each query sequentially (parallelism could be added later)
    const results: SearchResult[] = []

    for (const descricao of params.descricoes) {
      const result = await this.smartSearch({
        descricao,
        top_k: params.top_k,
        use_tfidf: params.use_tfidf,
      })
      results.push(result)
    }

    return results
  }

  async isReady(): Promise<boolean> {
    return this.isInitialized && this.tfidfIndex !== null && this.reranker !== null
  }

  private emptyResult(
    query: string,
    queryNormalized: string,
    consonantKey: string,
    expansions: string[],
    timing: TimingCollector,
    queryDomain?: ReturnType<typeof classifyQuery>
  ): SearchResult {
    const result: SearchResult = {
      query_original: query,
      query_normalizada: queryNormalized,
      consonant_key: consonantKey,
      expansoes_detectadas: expansions,
      modelo_semantico: DEFAULT_SEMANTIC_MODEL,
      modelo_reranker: DEFAULT_RERANKER_MODEL,
      resultados: [],
      total: 0,
    }

    if (this.config.enableDebugInfo && queryDomain) {
      result.debug = {
        timings: timing.getTimings(),
        queryDomain,
        topDomainStats: {
          cleaning_core: 0,
          cleaning_support: 0,
          peripheral: 0,
          unknown: 0,
        },
      }
    }

    return result
  }

  // =============================================================================
  // New Search Modes: BM25 Only, Semantic Only, Hybrid
  // =============================================================================

  /**
   * Search using BM25 only (lexical search, no semantic reranking)
   * 
   * @param query Query text
   * @param topK Number of results to return
   * @returns Search results ranked by BM25 score only
   */
  async searchBm25Only(query: string, topK: number): Promise<SearchResultItem[]> {
    await this.initialize()

    if (!this.tfidfIndex) {
      throw new Error('TF-IDF index not initialized')
    }

    const queryNormalized = normalizeEquip(query)
    const bm25Results = this.tfidfIndex.search(queryNormalized, topK)

    const resultItems: SearchResultItem[] = []
    for (const result of bm25Results) {
      const doc = this.corpus.get(result.id)
      const sugeridos = await this.corpusRepository.getSugestoes(result.id)

      resultItems.push({
        grupo: result.id,
        descricao: doc?.text ?? result.id,
        score: result.score,
        score_normalized: result.score,
        score_breakdown: {
          bm25: result.score,
          combined: result.score,
        },
        sugeridos,
      })
    }

    return resultItems
  }

  /**
   * Search using semantic similarity only (no BM25, no cross-encoder)
   * 
   * Requires SemanticSearchService to be configured and corpus to have embeddings.
   * 
   * @param query Query text
   * @param topK Number of results to return
   * @returns Search results ranked by cosine similarity only
   */
  async searchSemanticOnly(query: string, topK: number): Promise<SearchResultItem[]> {
    await this.initialize()

    if (!this.semanticSearchService) {
      throw new Error(
        'Semantic search not available: SemanticSearchService not configured. ' +
        'Pass semanticSearchService to TsHybridEngine constructor.'
      )
    }

    try {
      const semanticResults = await this.semanticSearchService.search(query, topK)

      const resultItems: SearchResultItem[] = []
      for (const result of semanticResults) {
        const doc = this.corpus.get(result.docId)
        const sugeridos = await this.corpusRepository.getSugestoes(result.docId)

        resultItems.push({
          grupo: result.docId,
          descricao: doc?.text ?? result.docId,
          score: result.score,
          score_normalized: result.score,
          score_breakdown: {
            semantic: result.score,
            combined: result.score,
          },
          sugeridos,
        })
      }

      return resultItems

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      console.error(`[${this.name}] Semantic search failed: ${errorMsg}`)
      throw new Error(`Semantic search failed: ${errorMsg}`)
    }
  }

  /**
   * Hybrid search: combines BM25 and semantic similarity
   * 
   * Runs both BM25 and semantic search in parallel, then combines scores using weighted average.
   * 
   * @param query Query text
   * @param topK Number of results to return
   * @param alpha Weight for BM25 (0..1). Semantic weight = 1 - alpha. Default: 0.5 (equal weight)
   * @returns Search results ranked by hybrid score (alpha×BM25 + (1-alpha)×semantic)
   */
  async searchHybrid(query: string, topK: number, alpha = 0.5): Promise<SearchResultItem[]> {
    await this.initialize()

    if (!this.tfidfIndex) {
      throw new Error('TF-IDF index not initialized')
    }

    if (!this.semanticSearchService) {
      console.warn(
        `[${this.name}] Semantic search not configured, falling back to BM25 only`
      )
      return this.searchBm25Only(query, topK)
    }

    // Validate alpha
    const alphaClamp = Math.max(0, Math.min(1, alpha))
    const betaSemantic = 1 - alphaClamp

    try {
      // Run both searches in parallel
      const queryNormalized = normalizeEquip(query)
      const [bm25Results, semanticResults] = await Promise.all([
        Promise.resolve(this.tfidfIndex.search(queryNormalized, topK * 2)), // Get more candidates
        this.semanticSearchService.search(query, topK * 2),
      ])

      // Normalize BM25 scores
      const maxBm25Score = Math.max(...bm25Results.map(r => r.score), 0.0001)
      const bm25Map = new Map<string, number>()
      for (const result of bm25Results) {
        bm25Map.set(result.id, result.score / maxBm25Score)
      }

      // Normalize semantic scores
      const maxSemanticScore = Math.max(...semanticResults.map(r => r.score), 0.0001)
      const semanticMap = new Map<string, number>()
      for (const result of semanticResults) {
        semanticMap.set(result.docId, result.score / maxSemanticScore)
      }

      // Combine scores: union of all document IDs
      const allDocIds = new Set([
        ...bm25Map.keys(),
        ...semanticMap.keys(),
      ])

      interface HybridScore {
        docId: string
        bm25Norm: number
        semanticNorm: number
        hybridScore: number
      }

      const hybridScores: HybridScore[] = []
      for (const docId of allDocIds) {
        const bm25Norm = bm25Map.get(docId) ?? 0
        const semanticNorm = semanticMap.get(docId) ?? 0
        const hybridScore = alphaClamp * bm25Norm + betaSemantic * semanticNorm

        hybridScores.push({
          docId,
          bm25Norm,
          semanticNorm,
          hybridScore,
        })
      }

      // Sort by hybrid score descending
      hybridScores.sort((a, b) => b.hybridScore - a.hybridScore)

      // Format top-K results
      const resultItems: SearchResultItem[] = []
      for (const scored of hybridScores.slice(0, topK)) {
        const doc = this.corpus.get(scored.docId)
        const sugeridos = await this.corpusRepository.getSugestoes(scored.docId)

        resultItems.push({
          grupo: scored.docId,
          descricao: doc?.text ?? scored.docId,
          score: scored.hybridScore,
          score_normalized: scored.hybridScore,
          score_breakdown: {
            bm25: scored.bm25Norm,
            semantic: scored.semanticNorm,
            hybrid: scored.hybridScore,
            combined: scored.hybridScore,
          },
          sugeridos,
        })
      }

      return resultItems

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      console.error(`[${this.name}] Hybrid search failed: ${errorMsg}. Falling back to BM25 only.`)
      
      // Fallback to BM25 only
      return this.searchBm25Only(query, topK)
    }
  }

  /**
   * Compute domain distribution statistics for search results
   */
  private computeDomainStats(items: SearchResultItem[]): DomainStats {
    const stats: DomainStats = {
      cleaning_core: 0,
      cleaning_support: 0,
      peripheral: 0,
      unknown: 0,
    }

    for (const item of items) {
      const doc = this.corpus.get(item.grupo)
      if (doc?.domain) {
        stats[doc.domain.category]++
      } else {
        stats.unknown++
      }
    }

    return stats
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a TS Hybrid search engine instance
 */
export function createTsHybridEngine(
  corpusRepository: CorpusRepository,
  embeddingProvider: EmbeddingProvider,
  crossEncoderProvider: CrossEncoderProvider,
  config?: TsHybridEngineConfig,
  semanticSearchService?: SemanticSearchService
): TsHybridSearchEngine {
  return new TsHybridSearchEngine(
    corpusRepository,
    embeddingProvider,
    crossEncoderProvider,
    config,
    semanticSearchService
  )
}
