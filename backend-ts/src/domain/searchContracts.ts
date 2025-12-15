/**
 * Search Contracts
 *
 * Re-exports types from the generated search_api.types.ts
 * Provides a clean interface for the rest of the application.
 */

// Re-export all types from the generated file
export type {
  // Request types
  Query,
  BatchQuery,
  // Simple search response types
  ResultadoBusca,
  BuscarResponse,
  ResultadoLote,
  BuscarLoteResponse,
  // Smart search response types
  ScoreBreakdown,
  SugeridoItem,
  SmartSearchResultItem,
  SmartSearchResponse,
  BatchSmartSearchResponse,
  // Details response types
  EquipamentoItem,
  DetalhesResponse,
  // Feedback types
  FeedbackItem,
  BatchFeedback,
  // Favorites & Kit types
  FavoriteItem,
  KitItem,
  // Utility types
  ErrorResponse,
  HealthResponse,
  CacheStatsResponse,
  DataStatusResponse,
} from '../contracts/search_api.types.js'

// Re-export type guards
export {
  isSmartSearchResponse,
  isBuscarResponse,
  isErrorResponse,
} from '../contracts/search_api.types.js'

/**
 * Alias types for more descriptive naming
 */
export type BuscarInteligenteRequest = import('../contracts/search_api.types.js').Query
export type BuscarInteligenteResponse = import('../contracts/search_api.types.js').SmartSearchResponse
export type BuscarSimplesRequest = import('../contracts/search_api.types.js').Query
export type BuscarSimplesResponse = import('../contracts/search_api.types.js').BuscarResponse
export type BuscarLoteRequest = import('../contracts/search_api.types.js').BatchQuery
export type BuscarLoteSimplesResponse = import('../contracts/search_api.types.js').BuscarLoteResponse
export type BuscarLoteInteligenteResponse = import('../contracts/search_api.types.js').BatchSmartSearchResponse
