/**
 * Search Response Type Definitions
 */

export interface SearchResultItem {
    grupo: string;
    descricao: string;
    score: number;
    score_normalized: number;
    score_breakdown?: {
        bm25?: number;
        fuzzy?: number;
        synonym?: number;
        domain?: number;
    };
}

export interface SearchResponse {
    query_original: string;
    query_corrected?: string;
    resultados: SearchResultItem[];
    total: number;
    confianca?: {
        score: number;      // 0-1, normalized confidence score
        nivel: 'alta' | 'media' | 'baixa';  // qualitative confidence level
    };
    metadata: {
        engine: string;
        version: string;
        latency_ms: number;
        cache_hit: boolean;
        features: string[];
        request_id?: string;
    };
}

export interface BatchSearchResponse {
    results: SearchResponse[];
    total_queries: number;
    metadata: {
        total_latency_ms: number;
        avg_latency_ms: number;
    };
}

export interface HealthResponse {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    uptime_seconds: number;
    checks: {
        search_engine: 'pass' | 'fail';
        corpus: 'pass' | 'fail';
        memory: 'pass' | 'fail';
    };
    version: string;
}

export interface MetricsResponse {
    engine: {
        documents: number;
        vocabulary_size: number;
    };
    cache: {
        size: number;
        hit_rate: number;
    };
    performance: {
        requests_total: number;
        latency_p50_ms: number;
        latency_p95_ms: number;
        error_rate: number;
    };
    system: {
        memory_mb: number;
        uptime_seconds: number;
    };
}
