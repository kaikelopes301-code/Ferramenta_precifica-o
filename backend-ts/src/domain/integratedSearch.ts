/**
 * 🔴 DEPRECATED – CÓDIGO LEGADO
 * 
 * Este módulo está obsoleto e foi substituído por:
 * - TsHybridEngine (src/domain/engines/tsHybridEngine.ts) com três modos de busca
 * - SemanticSearchService (src/domain/semanticSearchService.ts) para busca semântica
 * 
 * RAZÃO: Pipeline complexo substituído por busca híbrida BM25+Semantic mais eficiente
 * STATUS: Preservado para referência histórica, não usar em código novo
 * DATA: Janeiro 2025
 * 
 * ============================================================================
 * 
 * Integrated Search Pipeline
 * 
 * Combines: Fuzzy Matching + Synonym Expansion + BM25
 * 
 * Pipeline Flow:
 * 1. Query Normalization
 * 2. Fuzzy Correction (fixes typos)
 * 3. Synonym Expansion (improves recall)
 * 4. BM25 Search (ranks results)
 * 5. Score aggregation and final ranking
 * 
 * This is 100% FREE - no external APIs needed!
 */

import { BM25Index, BM25Document, BM25Result } from './bm25.js';
import { FuzzyMatcher, buildFuzzyMatcherFromCorpus } from './fuzzyMatcher.js';
import { SearchCache } from './services/cache/SearchCache.js';
import { normalizeText } from '../utils/textNormalization.js';
import type { AbbrevCompiled, QueryPlan } from '../search/searchTextPipeline.js';
import { rewriteQuery } from '../search/searchTextPipeline.js';

/**
 * Configuration for integrated search
 */
export interface IntegratedSearchConfig {
    /** Enable fuzzy matching for typo correction */
    enableFuzzy?: boolean;
    /** Enable deterministic abbrev rewrites (exactMap/tokenMap/expandMap) */
    enableAbbrev?: boolean;
    /** Pre-compiled abbrev maps (loaded once at startup) */
    abbrevCompiled?: AbbrevCompiled | null;
    /** Max total query variants (including primary) */
    maxVariantsTotal?: number;
    /** Max expandMap items to add */
    maxExpandItems?: number;
    /** Enable expandMap usage (generic queries only) */
    enableExpandMap?: boolean;
    /** BM25 parameters */
    bm25Config?: {
        k1?: number;
        b?: number;
    };
}

const DEFAULT_CONFIG: Required<IntegratedSearchConfig> = {
    enableFuzzy: true,
    enableAbbrev: true,
    abbrevCompiled: null,
    maxVariantsTotal: 10,
    maxExpandItems: 8,
    enableExpandMap: true,
    bm25Config: {
        k1: 1.5,
        b: 0.75,
    },
};

/**
 * Search result with enriched metadata
 */
export interface IntegratedSearchResult {
    id: string;
    score: number;
    /** Original query before any transformations */
    originalQuery: string;
    /** Query after fuzzy correction */
    correctedQuery?: string;
    /** All query variants used in search (including synonyms) */
    queryVariants: string[];
    /** Debug info */
    debug?: {
        hasFuzzyCorrections: boolean;
        synonymExpansionCount: number;
        scoreBreakdown: {
            maxBM25Score: number;
            queryVariantsUsed: number;
        };
    };
}

/**
 * Integrated Search Engine
 * 
 * Combines fuzzy matching, synonym expansion, and BM25 search
 */
export class IntegratedSearchEngine {
    private bm25Index: BM25Index;
    private fuzzyMatcher: FuzzyMatcher;
    private config: Required<IntegratedSearchConfig>;
    private cache: SearchCache<IntegratedSearchResult>;

    constructor(
        source: {
            documents?: BM25Document[];
            indexes?: { bm25Index: BM25Index; fuzzyMatcher: FuzzyMatcher };
        },
        config: IntegratedSearchConfig = {}
    ) {
        this.config = { ...DEFAULT_CONFIG, ...config };

        if (source.indexes) {
            // Load from pre-built indexes
            this.bm25Index = source.indexes.bm25Index;
            this.fuzzyMatcher = source.indexes.fuzzyMatcher;
        } else if (source.documents) {
            // Build from scratch
            this.bm25Index = BM25Index.build(source.documents, this.config.bm25Config);
            this.fuzzyMatcher = buildFuzzyMatcherFromCorpus(
                source.documents.map(d => ({ text: d.text }))
            );
        } else {
            throw new Error('IntegratedSearchEngine requires either documents or indexes');
        }

        // Initialize cache
        this.cache = new SearchCache<IntegratedSearchResult>();
    }

    getIndexes(): { bm25Index: BM25Index; fuzzyMatcher: FuzzyMatcher } {
        return { bm25Index: this.bm25Index, fuzzyMatcher: this.fuzzyMatcher };
    }

    /**
     * Search with integrated pipeline
     * 
     * @param query - User's search query
     * @param topK - Number of results to return
     * @returns Ranked search results
     */
    search(query: string, topK: number = 10): IntegratedSearchResult[] {
        const isDev = process.env.NODE_ENV !== 'production';
        const traceId = isDev ? `SEARCH_${Date.now()}` : '';

        const originalQuery = query;
        const normalizedQuery = normalizeText(originalQuery);

        if (!normalizedQuery) return [];

        if (isDev) {
            console.log(`\n[${traceId}] ========== INTEGRATED SEARCH PIPELINE START ==========`);
            console.log(`[${traceId}] Step 0: ORIGINAL QUERY = "${originalQuery}"`);
            console.log(`[${traceId}] Step 0b: NORMALIZED QUERY = "${normalizedQuery}"`);
        }

        // Check cache first
        const cached = this.cache.get(normalizedQuery);
        if (cached) {
            if (isDev) {
                console.log(`[${traceId}] 📦 CACHE HIT - Returning ${cached.length} cached results`);
            }
            return cached.slice(0, topK); // Respect topK even for cached results
        }

        // Track transformations for debugging
        let correctedQuery = normalizedQuery;
        let hasFuzzyCorrections = false;
        let plan: QueryPlan | null = null;

        // Step 1: Fuzzy correction (fix typos)
        if (this.config.enableFuzzy) {
            const correction = this.fuzzyMatcher.correctQuery(correctedQuery);
            correctedQuery = normalizeText(correction.corrected);
            hasFuzzyCorrections = correction.hasCorrections;
            
            if (isDev) {
                console.log(`[${traceId}] Step 1: FUZZY CORRECTION`);
                console.log(`[${traceId}]   - Enabled: true`);
                console.log(`[${traceId}]   - Corrected: "${correctedQuery}"`);
                console.log(`[${traceId}]   - Has corrections: ${hasFuzzyCorrections}`);
            }
        } else if (isDev) {
            console.log(`[${traceId}] Step 1: FUZZY CORRECTION - Disabled`);
        }

        // Step 2: Deterministic rewrite pipeline (abbrev maps + controlled expandMap)
        plan = rewriteQuery(originalQuery, this.config.enableAbbrev ? this.config.abbrevCompiled : null, {
            maxVariantsTotal: this.config.maxVariantsTotal,
            maxExpandItems: this.config.maxExpandItems,
            enableExpandMap: this.config.enableExpandMap,
        });

        // If fuzzy corrected something, prefer corrected normalized as the base for rewrites
        // (We keep originalQuery in plan.original for observability)
        if (hasFuzzyCorrections) {
            plan = rewriteQuery(correctedQuery, this.config.enableAbbrev ? this.config.abbrevCompiled : null, {
                maxVariantsTotal: this.config.maxVariantsTotal,
                maxExpandItems: this.config.maxExpandItems,
                enableExpandMap: this.config.enableExpandMap,
            });
        }

        if (isDev) {
            const variantsPreview = plan.variants
                .map(v => `{q:"${v.query}",w:${v.weight},r:${v.reason}}`)
                .join(', ');
            console.log(`[${traceId}] [QUERY_PLAN_DEBUG] original="${originalQuery}" normalized="${normalizedQuery}" corrected="${correctedQuery}" primary="${plan.primary}" usedExpandMap=${plan.usedExpandMap} rewriteTimeMs=${plan.rewriteTimeMs.toFixed(2)}`);
            console.log(`[${traceId}] [QUERY_PLAN_DEBUG] variants=[${variantsPreview}]`);
            if (plan.rewriteTimeMs > 5) {
                console.log(`[${traceId}] [QUERY_PLAN_DEBUG] ⚠️ rewrite above 5ms (${plan.rewriteTimeMs.toFixed(2)}ms)`);
            }
        }

        // Step 3: BM25 search with weighted variants (avoid MAX-over-expansion)
        const scoreMap = new Map<string, number>();
        
        if (isDev) {
            console.log(`[${traceId}] Step 3: BM25 SEARCH (variants=${plan.variants.length})`);
        }

        for (const variant of plan.variants) {
            // topK aqui representa o tamanho de candidatos desejado (candidateK),
            // calculado externamente (ex.: NavigationIntent pode pedir topK*8).
            const results = this.bm25Index.search(variant.query, topK);
            
            if (isDev) {
                console.log(`[${traceId}]   - Variant "${variant.query}" (w=${variant.weight}) found ${results.length} results`);
            }

            for (const result of results) {
                // Aggregate scores (weighted sum across variants)
                const currentScore = scoreMap.get(result.id) || 0;
                scoreMap.set(result.id, currentScore + result.score * variant.weight);
            }
        }

        if (isDev) {
            console.log(`[${traceId}]   - Total unique documents: ${scoreMap.size}`);
        }

        // Step 4: Convert to results array and sort
        const aggregatedResults: IntegratedSearchResult[] = [];

        for (const [id, score] of scoreMap) {
            aggregatedResults.push({
                id,
                score,
                originalQuery: originalQuery,
                correctedQuery: hasFuzzyCorrections ? correctedQuery : undefined,
                queryVariants: plan.variants.map(v => v.query),
                debug: {
                    hasFuzzyCorrections,
                    synonymExpansionCount: Math.max(0, plan.variants.length - 1),
                    scoreBreakdown: {
                        maxBM25Score: score,
                        queryVariantsUsed: plan.variants.length,
                    },
                },
            });
        }

        // Sort by score descending
        aggregatedResults.sort((a, b) => b.score - a.score);
        
        if (isDev) {
            console.log(`[${traceId}] Step 4: SORT BY SCORE`);
            console.log(`[${traceId}]   - Top 5 BEFORE final slice:`);
            aggregatedResults.slice(0, 5).forEach((r, i) => {
                console.log(`[${traceId}]     [${i+1}] id=${r.id.substring(0, 40)} score=${r.score.toFixed(2)}`);
            });
        }

        // Return top K (and cache full results)
        // We cache the full sorted list so we can serve different topK requests
        this.cache.set(normalizedQuery, aggregatedResults);
        
        const finalResults = aggregatedResults.slice(0, topK);
        
        if (isDev) {
            console.log(`[${traceId}] Step 5: RETURN TOP ${topK}`);
            console.log(`[${traceId}]   - Final results:`);
            finalResults.forEach((r, i) => {
                console.log(`[${traceId}]     [${i+1}] id=${r.id.substring(0, 40)} score=${r.score.toFixed(2)}`);
            });
            console.log(`[${traceId}] ========== INTEGRATED SEARCH PIPELINE END ==========\n`);
        }

        return finalResults;
    }

    /**
     * Search with all features enabled (convenience method)
     */
    smartSearch(query: string, topK: number = 10): IntegratedSearchResult[] {
        return this.search(query, topK);
    }

    /**
     * Search with only BM25 (no fuzzy, no synonyms)
     * Useful for benchmarking
     */
    bm25OnlySearch(query: string, topK: number = 10): BM25Result[] {
        return this.bm25Index.search(query, topK);
    }

    /**
     * Get search engine statistics
     */
    getStats(): {
        documentCount: number;
        vocabularySize: number;
        config: Required<IntegratedSearchConfig>;
        cache: { size: number };
    } {
        return {
            documentCount: this.bm25Index.documentCount,
            vocabularySize: this.fuzzyMatcher.vocabularySize,
            config: this.config,
            cache: this.cache.stats,
        };
    }
}

/**
 * Factory function to create integrated search engine
 */
export function createIntegratedSearchEngine(
    documents: BM25Document[],
    config?: IntegratedSearchConfig
): IntegratedSearchEngine {
    return new IntegratedSearchEngine({ documents }, config);
}

/**
 * Factory function to create integrated search engine from pre-built indexes
 */
export function createIntegratedSearchEngineFromIndexes(
    indexes: { bm25Index: BM25Index; fuzzyMatcher: FuzzyMatcher },
    config?: IntegratedSearchConfig
): IntegratedSearchEngine {
    return new IntegratedSearchEngine({ indexes }, config);
}
