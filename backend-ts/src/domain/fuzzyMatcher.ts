/**
 * 🔴 DEPRECATED – CÓDIGO LEGADO
 * 
 * Este módulo está obsoleto e foi substituído por:
 * - Busca semântica (SemanticSearchService) que naturalmente lida com variações ortográficas
 * - BM25 com normalização robusta (src/domain/normalization.ts)
 * 
 * RAZÃO: Busca semântica resolve typos sem necessidade de correção explícita
 * STATUS: Preservado para referência histórica, não usar em código novo
 * DATA: Janeiro 2025
 * 
 * ============================================================================
 * 
 * Fuzzy String Matching for Search Queries
 * 
 * Purpose: Handle typos and spelling variations in user queries
 * Algorithm: Levenshtein distance with adaptive thresholds
 * 
 * Examples:
 * - "lavdora" → "lavadora" (1 char substitution)
 * - "aspiradro" → "aspirador" (1 char swap)
 * - "carrino" → "carrinho" (1 char insertion)
 * 
 * Performance: O(n*m) where n,m are string lengths
 */

import { distance as levenshtein } from 'fastest-levenshtein';

/**
 * Configuration for fuzzy matching
 */
export interface FuzzyMatchConfig {
    /** Maximum Levenshtein distance allowed */
    maxDistance?: number;
    /** Minimum similarity ratio (0-1) */
    minSimilarity?: number;
    /** Minimum query length to enable fuzzy matching */
    minQueryLength?: number;
}

const DEFAULT_CONFIG: Required<FuzzyMatchConfig> = {
    maxDistance: 2,
    minSimilarity: 0.75,
    minQueryLength: 4, // Don't fuzzy match very short words
};

/**
 * Calculate similarity ratio between two strings
 * 
 * Returns value between 0 (completely different) and 1 (identical)
 * Formula: 1 - (distance / max_length)
 */
export function similarityRatio(str1: string, str2: string): number {
    const dist = levenshtein(str1, str2);
    const maxLen = Math.max(str1.length, str2.length);

    if (maxLen === 0) return 1.0;

    return 1.0 - (dist / maxLen);
}

/**
 * Check if two strings are fuzzy matches
 */
export function isFuzzyMatch(
    query: string,
    candidate: string,
    config: FuzzyMatchConfig = {}
): boolean {
    const cfg = { ...DEFAULT_CONFIG, ...config };

    // Skip fuzzy matching for very short queries
    if (query.length < cfg.minQueryLength) {
        return query === candidate;
    }

    const dist = levenshtein(query, candidate);

    // Check distance threshold
    if (dist > cfg.maxDistance) {
        return false;
    }

    // Check similarity ratio
    const ratio = similarityRatio(query, candidate);
    return ratio >= cfg.minSimilarity;
}

/**
 * Find best fuzzy match from a list of candidates
 * 
 * @returns Tuple of [best_match, similarity_score] or null if no good match
 */
export function findBestFuzzyMatch(
    query: string,
    candidates: string[],
    config: FuzzyMatchConfig = {}
): [string, number] | null {
    const cfg = { ...DEFAULT_CONFIG, ...config };

    if (query.length < cfg.minQueryLength) {
        return null;
    }

    let bestMatch: string | null = null;
    let bestScore = 0;

    for (const candidate of candidates) {
        const ratio = similarityRatio(query, candidate);

        if (ratio >= cfg.minSimilarity && ratio > bestScore) {
            const dist = levenshtein(query, candidate);
            if (dist <= cfg.maxDistance) {
                bestMatch = candidate;
                bestScore = ratio;
            }
        }
    }

    return bestMatch ? [bestMatch, bestScore] : null;
}

/**
 * Fuzzy Matcher Class for search vocabulary
 * 
 * Pre-builds vocabulary and provides fast fuzzy correction
 */
export class FuzzyMatcher {
    private vocabulary: Set<string>;
    private config: Required<FuzzyMatchConfig>;

    constructor(vocabulary: string[], config: FuzzyMatchConfig = {}) {
        this.vocabulary = new Set(vocabulary.map(w => w.toLowerCase()));
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Correct a single token using fuzzy matching
     * 
     * @param token - Token to correct
     * @returns Corrected token or original if no good match found
     */
    correct(token: string): string {
        const lower = token.toLowerCase();

        // Exact match - no correction needed
        if (this.vocabulary.has(lower)) {
            return lower;
        }

        // Too short - don't correct
        if (lower.length < this.config.minQueryLength) {
            return lower;
        }

        // Find best fuzzy match in vocabulary
        const result = findBestFuzzyMatch(
            lower,
            Array.from(this.vocabulary),
            this.config
        );

        if (result) {
            const [match, score] = result;
            // Only return correction if confidence is high
            if (score >= this.config.minSimilarity) {
                return match;
            }
        }

        return lower; // No good correction found
    }

    /**
     * Correct all tokens in a query
     * 
     * @param query - Full query string
     * @returns Object with {corrected: string, corrections: Map<string, string>}
     */
    correctQuery(query: string): {
        corrected: string;
        corrections: Map<string, string>;
        hasCorrections: boolean;
    } {
        const tokens = query.toLowerCase().split(/\s+/);
        const corrections = new Map<string, string>();
        const correctedTokens: string[] = [];

        for (const token of tokens) {
            const corrected = this.correct(token);
            correctedTokens.push(corrected);

            if (corrected !== token) {
                corrections.set(token, corrected);
            }
        }

        return {
            corrected: correctedTokens.join(' '),
            corrections,
            hasCorrections: corrections.size > 0,
        };
    }

    /**
     * Add new terms to vocabulary
     */
    addToVocabulary(terms: string[]): void {
        for (const term of terms) {
            this.vocabulary.add(term.toLowerCase());
        }
    }

    /**
     * Get vocabulary size
     */
    get vocabularySize(): number {
        return this.vocabulary.size;
    }

    /**
     * Serialize to JSON
     */
    toJSON(): any {
        return {
            vocabulary: Array.from(this.vocabulary),
            config: this.config,
        };
    }

    /**
     * Load from JSON
     */
    static fromJSON(json: any): FuzzyMatcher {
        const matcher = new FuzzyMatcher([], json.config);
        matcher.vocabulary = new Set(json.vocabulary);
        return matcher;
    }
}

/**
 * Build fuzzy matcher from corpus
 * 
 * Extracts all unique tokens from corpus documents to build vocabulary
 */
export function buildFuzzyMatcherFromCorpus(
    documents: Array<{ text: string }>,
    config: FuzzyMatchConfig = {}
): FuzzyMatcher {
    const vocabulary = new Set<string>();

    for (const doc of documents) {
        // Tokenize and add to vocabulary
        const tokens = doc.text.toLowerCase().split(/\s+/);
        for (const token of tokens) {
            // Only add meaningful tokens (length >= 3)
            if (token.length >= 3) {
                vocabulary.add(token);
            }
        }
    }

    return new FuzzyMatcher(Array.from(vocabulary), config);
}
