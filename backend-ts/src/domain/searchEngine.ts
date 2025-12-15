/**
 * Search Engine Interface
 *
 * This module defines the core interface for search engines and related types.
 * It enables swapping between Python proxy and native TS implementations
 * via feature flags without changing the public API.
 *
 * Design:
 * - SearchEngine is the core interface all engines implement
 * - Types mirror the Python API response structure for compatibility
 * - Engines can be composed (e.g., fallback, dual-mode)
 */

import type {
  SmartSearchResponse,
  SmartSearchResultItem,
  ScoreBreakdown,
  SugeridoItem,
} from './searchContracts.js'
import type { DomainClassification } from './domainClassification.js'
import type { TimingEntry } from '../utils/timing.js'

// =============================================================================
// Search Engine Types
// =============================================================================

/**
 * Search parameters (mirrors Python Query type)
 */
export interface SearchParams {
  /** Search query text */
  descricao: string
  /** Maximum results to return (default: 10) */
  top_k?: number
  /** Minimum score threshold (default: 0.0) */
  min_score?: number
  /** Force TF-IDF fallback (default: false) */
  use_tfidf?: boolean
}

/**
 * Batch search parameters (mirrors Python BatchQuery type)
 */
export interface BatchSearchParams {
  /** List of search queries */
  descricoes: string[]
  /** Maximum results per query (default: 10) */
  top_k?: number
  /** Force TF-IDF fallback (default: false) */
  use_tfidf?: boolean
}

/**
 * Métricas numéricas agregadas (v4.0+)
 */
export interface NumericMetrics {
  /** Valor de exibição (mediana ou média aparada) */
  display: number
  /** Média aritmética */
  mean: number
  /** Mediana (valor central) */
  median: number
  /** Valor mínimo */
  min: number
  /** Valor máximo */
  max: number
  /** Quantidade de amostras */
  n: number
  /** Unidade (para manutenção: 'fraction' = 0..1, 'percent' = 0..100) */
  unit?: 'fraction' | 'percent'
}

/**
 * Corpus document for indexing
 *
 * Suporta dois formatos:
 * - LEGACY (v3.0): price/lifespanMonths/maintenancePercent como campos simples
 * - AGGREGATED (v4.0): metrics com estatísticas completas (mean/median/min/max/n)
 */
export interface CorpusDocument {
  /** Unique document identifier */
  id: string
  /** Group/family ID (usado para agrupamento) */
  groupId: string
  /** Equipment ID canônico (v4.0+) - chave estável para dedup */
  equipmentId?: string
  /** Título limpo para display (v4.0+) */
  title?: string
  /** Group description (for display) */
  groupDescription?: string
  /** Normalized text for search (via normalize_equip) */
  text: string
  /** Original raw text for display */
  rawText?: string
  /** Rich semantic text for embeddings */
  semanticText?: string

  /** Categoria semântica persistida no dataset (build-time) */
  docCategory?: string
  /** Tipo do documento persistido no dataset (build-time) */
  docType?: 'EQUIPAMENTO' | 'ACESSORIO' | 'INDEFINIDO'
  /** Domain classification (cleaning_core, cleaning_support, peripheral, unknown) */
  domain?: DomainClassification
  /** Optional pre-computed embeddings */
  embedding?: number[]
  /** Supplier/source name */
  supplier?: string
  /** Brand name */
  brand?: string
  
  // === LEGACY FIELDS (v3.0) - mantidos para compatibilidade ===
  /** Unit price (BRL) - LEGACY: usar metrics.valorUnitario quando disponível */
  price?: number
  /** Useful life in months - LEGACY: usar metrics.vidaUtilMeses quando disponível */
  lifespanMonths?: number
  /** Maintenance percentage - LEGACY: usar metrics.manutencao quando disponível */
  maintenancePercent?: number
  
  // === AGGREGATED FIELDS (v4.0+) ===
  /** Métricas agregadas com estatísticas completas */
  metrics?: {
    valorUnitario?: NumericMetrics
    vidaUtilMeses?: NumericMetrics
    manutencao?: NumericMetrics
  }
  
  /** Rastreabilidade (v4.0+) */
  sources?: {
    fornecedores: string[]
    bids: string[]
    marcas: string[]
    nLinhas: number
  }
  
  /** Additional metadata */
  metadata?: Record<string, unknown>
}

/**
 * Domain statistics for search results
 */
export interface DomainStats {
  cleaning_core: number
  cleaning_support: number
  peripheral: number
  unknown: number
}

/**
 * Engine metadata for HTTP headers (observability)
 */
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
 * Debug information for search results (observability)
 */
export interface SearchDebugInfo {
  /** Timing breakdown for search operations */
  timings: TimingEntry[]
  /** Query domain classification */
  queryDomain?: DomainClassification
  /** Domain distribution in top results */
  topDomainStats?: DomainStats
  /** Engine metadata (for HTTP headers) */
  engineMetadata?: EngineMetadata
}

/**
 * Search result item (internal representation)
 */
export interface SearchResultItem {
  /** Equipment group ID */
  grupo: string
  /** Equipment ID canônico (v4.0+) para dedup */
  equipmentId?: string
  /** Equipment description */
  descricao: string
  /** Final combined score (0-1) */
  score: number
  /** Normalized score (0-1) */
  score_normalized: number
  /** Rank score - única fonte de verdade para ordenação (v4.0+) */
  rankScore?: number
  /** Confiança do item (0-1) - monótona com rankScore (v4.0+) */
  confidenceItem?: number
  /** Score component breakdown */
  score_breakdown?: ScoreBreakdown
  /** Suggested similar items */
  sugeridos: SugeridoItem[]
}

/**
 * Search result (internal representation)
 */
export interface SearchResult {
  /** Original query text */
  query_original: string
  /** Normalized query text */
  query_normalizada: string
  /** Consonant signature key */
  consonant_key: string
  /** Detected expansions/variants */
  expansoes_detectadas: string[]
  /** Semantic model used */
  modelo_semantico: string
  /** Reranker model used */
  modelo_reranker: string
  /** Search results */
  resultados: SearchResultItem[]
  /** Total results count */
  total: number
  /** Whether fallback was used */
  fallback?: boolean
  /** Reason for fallback */
  fallback_reason?: string
  /** Optional debug information for observability */
  debug?: SearchDebugInfo
}

// =============================================================================
// Engine Mode Configuration
// =============================================================================

/**
 * Search engine mode
 */
export type SearchEngineMode = 'python' | 'ts' | 'dual'

/**
 * Default engine mode (TypeScript with automatic Python fallback)
 */
export const DEFAULT_ENGINE_MODE: SearchEngineMode = 'ts'

/**
 * Parse engine mode from string
 */
export function parseEngineMode(value: string | undefined): SearchEngineMode {
  if (value === 'python') return 'python'
  if (value === 'dual') return 'dual'
  if (value === 'ts' || value === 'typescript') return 'ts'
  // Default to TS for production
  return 'ts'
}

// =============================================================================
// Search Engine Interface
// =============================================================================

/**
 * Core search engine interface
 *
 * All search engines (Python proxy, TS native, etc.) implement this interface.
 * This enables feature-flag controlled engine selection without changing routes.
 */
export interface SearchEngine {
  /**
   * Perform smart search (semantic + reranking)
   */
  smartSearch(params: SearchParams): Promise<SearchResult>

  /**
   * Perform batch smart search
   */
  smartSearchBatch(params: BatchSearchParams): Promise<SearchResult[]>

  /**
   * Engine name for logging/debugging
   */
  readonly name: string

  /**
   * Check if engine is ready (models loaded, index built, etc.)
   */
  isReady(): Promise<boolean>
}

/**
 * Corpus repository interface for data access
 */
export interface CorpusRepository {
  /**
   * Get all documents for indexing
   */
  getAllDocuments(): Promise<CorpusDocument[]>

  /**
   * Get document by ID (grupo)
   */
  getDocumentById(id: string): Promise<CorpusDocument | null>

  /**
   * Get suggested items for a group
   */
  getSugestoes(grupo: string): Promise<SugeridoItem[]>
}

// =============================================================================
// Type Converters
// =============================================================================

/**
 * Convert internal SearchResult to API SmartSearchResponse
 */
export function toSmartSearchResponse(result: SearchResult): SmartSearchResponse {
  return {
    query_original: result.query_original,
    query_normalizada: result.query_normalizada,
    consonant_key: result.consonant_key,
    expansoes_detectadas: result.expansoes_detectadas,
    modelo_semantico: result.modelo_semantico,
    modelo_reranker: result.modelo_reranker,
    resultados: result.resultados.map(toSmartSearchResultItem),
    total: result.total,
    fallback: result.fallback,
    fallback_reason: result.fallback_reason,
  }
}

/**
 * Convert internal SearchResultItem to API SmartSearchResultItem
 */
export function toSmartSearchResultItem(item: SearchResultItem): SmartSearchResultItem {
  return {
    grupo: item.grupo,
    descricao: item.descricao,
    score: item.score,
    score_normalized: item.score_normalized,
    score_breakdown: item.score_breakdown,
    sugeridos: item.sugeridos,
    // Convert confidenceItem from 0-1 to 0-100 for API
    confidenceItem: item.confidenceItem !== undefined ? item.confidenceItem * 100 : undefined,
  }
}

// =============================================================================
// Re-exports for convenience
// =============================================================================

export type { ScoreBreakdown, SugeridoItem, SmartSearchResponse, SmartSearchResultItem }
