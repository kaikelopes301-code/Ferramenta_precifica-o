/**
 * Search API Types
 * 
 * @generated 2025-12-06 14:58:17
 * @source Python Pydantic models (backend/app/api/models.py)
 * 
 * IMPORTANT: This file is auto-generated. Do not edit manually.
 * To regenerate, run: python scripts/generate_ts_types.py
 */

// =============================================================================
// REQUEST/RESPONSE MODELS (from Pydantic)
// =============================================================================

export interface Query {
  descricao: string;
  top_k?: number;
  min_score?: number;
  use_tfidf?: boolean;
}

export interface BatchQuery {
  descricoes: string[];
  top_k?: number;
  use_tfidf?: boolean;
}

export interface FeedbackItem {
  ranking?: number | null;
  sugeridos: string;
  valor_unitario?: number | null;
  vida_util_meses?: number | null;
  manutencao_percent?: number | null;
  confianca?: number | null;
  sugestao_incorreta?: boolean;
  feedback?: string;
  equipamento_material_revisado?: string;
  query: string;
  use_tfidf?: boolean;
}

export interface BatchFeedback {
  items: Record<string, unknown>[];
  use_tfidf?: boolean;
}

export interface FavoriteItem {
  item_name: string;
  price?: number | null;
  extra?: Record<string, unknown> | null;
}

export interface KitItem {
  item_name: string;
  price?: number | null;
  qty?: number;
  extra?: Record<string, unknown> | null;
}

// =============================================================================
// RESPONSE TYPES (manual definitions based on API contract)
// =============================================================================

// See docs/search_api.types.ts for complete type definitions
// including SmartSearchResponse, DetalhesResponse, etc.
