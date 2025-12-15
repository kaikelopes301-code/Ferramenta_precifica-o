/**
 * Data Transfer Objects (DTOs)
 * 
 * Strict type definitions for internal data structures.
 * Eliminates usage of 'any' throughout the application.
 * 
 * @version 1.0.0
 */

// =============================================================================
// SEARCH RESULT DTOs
// =============================================================================

/**
 * Internal search result item before API transformation
 * 
 * Origin: Built from corpus document + search engine scores
 * Used in: searchRoutes.ts line 157
 * 
 * Compatible with frontend expectations:
 * - grupo (groupId)
 * - descricao (alias: sugeridos in frontend)
 * - score + score_normalized + score_breakdown
 * - valor_unitario (price)
 * - vida_util_meses
 * - manutencao_percent
 * - marca (brand)
 * - link_detalhes (generated)
 */
export interface SearchResultItemDTO {
    /** Equipment group ID */
    grupo: string;
    
    /** Equipment group description (frontend expects as 'sugeridos') */
    descricao: string;
    
    /** Alias for descricao (frontend compatibility) */
    sugeridos?: string;
    
    /** Raw BM25 score */
    score: number;
    
    /** Normalized score (0-1 range) */
    score_normalized: number;
    
    /** Final rank score (post-rerank) - ÚNICA fonte de verdade para ordenação e confiança */
    rankScoreFinal?: number;
    
    /** Score breakdown by algorithm */
    score_breakdown: {
        /** BM25 relevance score */
        bm25: number;
        
        /** Fuzzy matching bonus (0 or 0.1) */
        fuzzy: number;
        
        /** Synonym expansion bonus (0 or 0.1) */
        synonym: number;
    };
    
    /** Confiança do item (0-100) - monótona com score (v4.0+) */
    confidenceItem?: number;
    
    /** Unit price (BRL) - frontend expects this */
    valor_unitario?: number | null;
    
    /** Useful life in months - frontend expects this */
    vida_util_meses?: number | null;
    
    /** Maintenance percentage - frontend expects this */
    manutencao_percent?: number | null;
    
    /** Brand name - frontend expects as 'marca' */
    marca?: string;
    
    /** Supplier/source name - frontend expects as 'fornecedor' */
    fornecedor?: string;
    
    /** Link to details page */
    link_detalhes?: string;
}

// =============================================================================
// KIT / BUDGET DTOs
// =============================================================================

/**
 * Budget item for kit calculation
 * 
 * Origin: Derived from KitItem entity in calculateBudget()
 * Used in: KitRepository.ts line 60
 */
export interface BudgetItemDTO {
    /** Item name/description */
    item: string;
    
    /** Unit price (BRL) */
    price: number;
    
    /** Quantity */
    qty: number;
    
    /** Line total (price * qty) */
    subtotal: number;
}

/**
 * Complete budget calculation result
 * 
 * Used in: KitRepository.ts line 60
 */
export interface BudgetCalculationDTO {
    /** List of budget items */
    items: BudgetItemDTO[];
    
    /** Grand total (BRL) */
    total: number;
}

// =============================================================================
// USER PREFERENCES DTOs
// =============================================================================

/**
 * User preferences data structure
 * 
 * Origin: Stored as JSON string in UserPreference.data column
 * Used in: UserPreferencesRepository.ts lines 25, 61
 * 
 * Note: All fields are optional to support gradual preference building
 */
export interface UserPreferencesDTO {
    /** User's preferred context tags for search refinement */
    context_tags?: string[];
    
    /** UI theme preference */
    theme?: 'light' | 'dark' | 'auto';
    
    /** Default results per page */
    default_page_size?: number;
    
    /** Enable search suggestions */
    enable_suggestions?: boolean;
    
    /** Preferred equipment categories */
    preferred_categories?: string[];
    
    /** Last search queries (max 10) */
    recent_searches?: string[];
    
    /** Custom user settings (extensible) */
    custom_settings?: Record<string, unknown>;
}

/**
 * Type guard to validate UserPreferencesDTO structure
 */
export function isUserPreferencesDTO(data: unknown): data is UserPreferencesDTO {
    if (typeof data !== 'object' || data === null) {
        return false;
    }
    
    const obj = data as Record<string, unknown>;
    
    // All fields are optional, but if present must match type
    if (obj.context_tags !== undefined && !Array.isArray(obj.context_tags)) {
        return false;
    }
    
    if (obj.theme !== undefined && !['light', 'dark', 'auto'].includes(obj.theme as string)) {
        return false;
    }
    
    if (obj.default_page_size !== undefined && typeof obj.default_page_size !== 'number') {
        return false;
    }
    
    return true;
}

// =============================================================================
// REPOSITORY FILTER DTOs
// =============================================================================

/**
 * Filters for KitItem queries
 */
export interface KitItemFilters {
    user_id?: string;
}

/**
 * Generic repository filters (extensible per entity)
 */
export type RepositoryFilters<T> = Partial<Record<keyof T, unknown>>;
