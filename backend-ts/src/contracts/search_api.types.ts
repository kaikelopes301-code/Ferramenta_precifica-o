/**
 * Search API Types
 *
 * @version 2.0.0
 * @generated from Python Pydantic models (source of truth)
 * @see ../../docs/search_api_contract.md
 *
 * IMPORTANT: This file is copied from docs/search_api.types.ts
 * Do not edit manually. To regenerate, run: python scripts/generate_ts_types.py
 */

// =============================================================================
// REQUEST TYPES
// =============================================================================

/**
 * Single search query request
 */
export interface Query {
  /** Descrição do equipamento a buscar */
  descricao: string
  /** Número máximo de resultados (default: 10) */
  top_k?: number
  /** Score mínimo para filtrar resultados (default: 0.0) */
  min_score?: number
  /** Forçar uso de TF-IDF (default: false) */
  use_tfidf?: boolean
}

/**
 * Batch search query request
 */
export interface BatchQuery {
  /** Lista de descrições para buscar */
  descricoes: string[]
  /** Número máximo de resultados por query (default: 10) */
  top_k?: number
  /** Forçar uso de TF-IDF como fallback (default: false) */
  use_tfidf?: boolean
}

// =============================================================================
// RESPONSE TYPES - SIMPLE SEARCH
// =============================================================================

/**
 * Individual search result item
 */
export interface ResultadoBusca {
  grupo: string
  descricao: string
  score: number
  score_normalized?: number
}

/**
 * Response for POST /buscar
 */
export interface BuscarResponse {
  resultados: ResultadoBusca[]
  atributos: Record<string, unknown>
  total: number
}

/**
 * Batch result item for simple search
 */
export interface ResultadoLote {
  query_original: string
  resultados: ResultadoBusca[]
}

/**
 * Response for POST /buscar-lote
 */
export interface BuscarLoteResponse {
  resultados: ResultadoLote[]
  total: number
}

// =============================================================================
// RESPONSE TYPES - SMART SEARCH
// =============================================================================

/**
 * Score breakdown for smart search results
 */
export interface ScoreBreakdown {
  tfidf: number
  semantic: number
  reranker: number
  domain: number
  combined: number
}

/**
 * Suggested equipment item
 */
export interface SugeridoItem {
  grupo: string
  descricao: string
  preco?: number
  score: number
}

/**
 * Smart search result item
 */
export interface SmartSearchResultItem {
  grupo: string
  descricao: string
  score: number
  score_normalized: number
  score_breakdown?: ScoreBreakdown
  sugeridos: SugeridoItem[]
  /** Confiança do item (0-100) - monótona com rankScore (v4.0+) */
  confidenceItem?: number
}

/**
 * Response for POST /buscar-inteligente
 */
export interface SmartSearchResponse {
  query_original: string
  query_normalizada: string
  consonant_key: string
  expansoes_detectadas: string[]
  modelo_semantico: string
  modelo_reranker: string
  resultados: SmartSearchResultItem[]
  total: number
  /** Set if fallback to TF-IDF was used */
  fallback?: boolean
  /** Reason for fallback (timeout, error, etc) */
  fallback_reason?: string
}

/**
 * Response for POST /buscar-lote-inteligente
 */
export interface BatchSmartSearchResponse {
  resultados: SmartSearchResponse[]
  total: number
}

// =============================================================================
// RESPONSE TYPES - DETAILS
// =============================================================================

/**
 * Equipment item details (fields may vary based on dataset)
 */
export interface EquipamentoItem {
  descricao: string
  codigo?: string
  preco?: number
  unidade?: string
  [key: string]: unknown // Dynamic fields from dataset
}

/**
 * Response for GET /detalhes/{grupo}
 */
export interface DetalhesResponse {
  grupo: string
  items: EquipamentoItem[]
  total: number
}

// =============================================================================
// FEEDBACK TYPES
// =============================================================================

/**
 * Feedback item for search result
 */
export interface FeedbackItem {
  query: string
  grupo: string
  is_relevant: boolean
  comment?: string
}

/**
 * Batch feedback request
 */
export interface BatchFeedback {
  items: FeedbackItem[]
}

// =============================================================================
// FAVORITES & KIT TYPES
// =============================================================================

/**
 * Favorite equipment item
 */
export interface FavoriteItem {
  id?: number
  grupo: string
  descricao: string
  created_at?: string
}

/**
 * Kit item
 */
export interface KitItem {
  id?: number
  grupo: string
  descricao: string
  quantidade: number
  preco_unitario?: number
  created_at?: string
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

/**
 * Generic error response
 */
export interface ErrorResponse {
  detail: string
}

/**
 * Health check response
 */
export interface HealthResponse {
  status: 'ok' | 'error'
  version: string
  uptime_seconds: number
}

/**
 * Cache stats response
 */
export interface CacheStatsResponse {
  lru_cache: {
    size: number
    max_size: number
    hit_rate: number
  }
  json_cache: {
    size: number
    file_count: number
  }
}

/**
 * Data status response
 */
export interface DataStatusResponse {
  loaded: boolean
  row_count: number
  column_count: number
  columns: string[]
  last_updated?: string
}

// =============================================================================
// TYPE GUARDS
// =============================================================================

export function isSmartSearchResponse(obj: unknown): obj is SmartSearchResponse {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'query_original' in obj &&
    'query_normalizada' in obj &&
    'resultados' in obj
  )
}

export function isBuscarResponse(obj: unknown): obj is BuscarResponse {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'resultados' in obj &&
    'atributos' in obj &&
    'total' in obj
  )
}

export function isErrorResponse(obj: unknown): obj is ErrorResponse {
  return (
    typeof obj === 'object' && obj !== null && 'detail' in obj && typeof (obj as ErrorResponse).detail === 'string'
  )
}
