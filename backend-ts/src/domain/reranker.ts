/**
 * Reranker Module - Deterministic Intent-Based Reranking
 * 
 * Lightweight post-BM25 reranker to fix accessory vs equipment ranking issues.
 * NO external dependencies, NO heavy ML models - pure TypeScript logic.
 * 
 * Problem: Query "enceradeira 510 c/ discos" ranks "disco" higher than "enceradeira 510"
 * Solution: Detect intent (EQUIPMENT), penalize accessories when intent is equipment
 * 
 * @module reranker
 */

// ========================================
// DEBUG HELPERS (Dev-only)
// ========================================

/**
 * Extract numeric tokens from text (>=3 digits for model numbers)
 * Used for debug/tracing purposes
 */
export function extractNumericTokens(text: string): string[] {
    const normalized = normalizeText(text).replace(/[^a-z0-9\s]/g, ' ');
    const tokens = normalized.split(/\s+/);
    const numbers: string[] = [];
    
    for (const token of tokens) {
        // Match any token containing 3+ consecutive digits
        const match = token.match(/\d{3,}/);
        if (match) {
            numbers.push(match[0]);
        }
    }
    
    return [...new Set(numbers)]; // Deduplicate
}

/**
 * Normalize alphanumeric tokens for better matching
 * Example: "510mm" → "510 mm"
 */
export function normalizeAlphaNumeric(text: string): string {
    return text
        .replace(/(\d+)([a-z]+)/gi, '$1 $2') // 510mm → 510 mm
        .replace(/([a-z]+)(\d+)/gi, '$1 $2') // cl510 → cl 510
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check if two numeric token sets overlap
 */
export function hasNumericOverlap(nums1: string[], nums2: string[]): boolean {
    if (nums1.length === 0 || nums2.length === 0) return false;
    
    for (const n1 of nums1) {
        if (nums2.includes(n1)) return true;
    }
    return false;
}

/**
 * Build core query by removing accessory terms and connectors
 * 
 * For mixed queries (equipment + accessories), this creates a clean query
 * focused on the equipment itself, preventing accessories from dominating BM25.
 * 
 * Example: "enceradeira de piso 510 c/ discos e escovas" → "enceradeira piso 510"
 */
export function buildCoreQuery(query: string, parsed: ParsedQuery): string {
    if (parsed.accessoryTerms.length === 0) {
        return query; // No accessories, return original
    }

    const normalized = normalize(query);
    let tokens = normalized.split(/\s+/);

    // Remove accessory terms
    tokens = tokens.filter(token => !parsed.accessoryTerms.includes(token));

    // Remove common connectors
    const connectors = new Set(['c', 'com', 'e', 'para', 'de', 'da', 'do', 'das', 'dos', 'a', 'o']);
    tokens = tokens.filter(token => !connectors.has(token));

    // Build core query
    let coreQuery = tokens.join(' ').trim();

    // Fallback 1: if empty, keep at least category + model
    if (!coreQuery) {
        const parts: string[] = [];
        if (parsed.mainCategory) parts.push(parsed.mainCategory);
        if (parsed.modelNumbers.length > 0) parts.push(...parsed.modelNumbers);
        coreQuery = parts.join(' ');
    }

    // Fallback 2: if still empty, use original query
    if (!coreQuery) {
        coreQuery = query;
    }

    return coreQuery;
}

// ========================================
// TYPES & INTERFACES
// ========================================

/**
 * User intent classification
 */
export type QueryIntent = 'EQUIPAMENTO' | 'ACESSORIO' | 'INDEFINIDO';

/**
 * Document type classification
 */
export type DocType = 'EQUIPAMENTO' | 'ACESSORIO' | 'INDEFINIDO';

export type DocCategory = 'MOP' | 'VASSOURA' | 'UNKNOWN';

/**
 * Parsed query with extracted attributes
 */
export interface ParsedQuery {
    /** Detected user intent */
    intent: QueryIntent;
    /** Main equipment category (e.g., "enceradeira", "lavadora") */
    mainCategory?: string;
    /** Model numbers found in query (e.g., ["510", "350"]) */
    modelNumbers: string[];
    /** Accessory terms found (e.g., ["disco", "escova"]) */
    accessoryTerms: string[];
    /** All normalized tokens */
    tokens: string[];
}

/**
 * Document classification result
 */
export interface DocClassification {
    /** Document type */
    docType: DocType;
    /** Equipment category if detected */
    category?: string;
    /** Whether doc contains accessory terms */
    hasAccessoryTerms: boolean;
    /** Whether doc contains category/equipment terms */
    hasCategoryTerms: boolean;
    /** Whether doc matches any model numbers from query */
    hasModelNumberMatch: boolean;
}

/**
 * Reranked result with debugging info
 */
export interface RerankedResult {
    /** Document ID */
    id: string;
    /** Normalized BM25 score (0-1) */
    bm25Norm: number;
    /** Model number boost (0 or 1) */
    modelBoost: number;
    /** Category match boost (0 or 1) */
    categoryBoost: number;
    /** Accessory penalty (0 or 1) */
    accessoryPenalty: number;
    /** Missing model penalty (0 or 1) */
    missingModelPenalty: number;
    /** Accessory bonus for equipment (0-0.12) */
    accessoryBonus: number;
    /** Final reranked score */
    finalScore: number;
    /** Document classification */
    classification: DocClassification;
}

// ========================================
// DICTIONARIES (no external deps!)
// ========================================

/**
 * Equipment category keywords (strong indicators)
 * These words indicate the user wants an EQUIPMENT, not an accessory
 */
import { normalizeText } from '../utils/textNormalization.js';
import {
    ACCESSORY_TERMS,
} from '../search/semantic/taxonomy.js';

const RERANKER_CATEGORIES = new Set<string>([
    // Principais categorias usadas nos testes e no catálogo
    'enceradeira',
    'lavadora',
    'aspirador',
    'extratora',
    'varredeira',
    'polidora',
    'vassoura',
    'mop',
    'carrinho',
]);

function findFirstCategoryTokenIndex(tokens: string[]): { category?: string; index: number } {
    let bestCategory: string | undefined;
    let bestIndex = -1;

    for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];
        if (RERANKER_CATEGORIES.has(t)) {
            bestCategory = t;
            bestIndex = i;
            break;
        }
    }

    return { category: bestCategory, index: bestIndex };
}

function detectRerankerCategory(text: string): string | undefined {
    const normalized = normalizeText(text);
    if (!normalized) return undefined;
    const tokens = normalized.split(/\s+/).filter(Boolean);
    return findFirstCategoryTokenIndex(tokens).category;
}

function canonicalAccessoryTerm(term: string): string {
    // Canonicaliza plurais comuns para bater com os testes (discos->disco, escovas->escova, etc.)
    const t = normalizeText(term);
    if (t === 'discos') return 'disco';
    if (t === 'escovas') return 'escova';
    if (t === 'refis') return 'refil';
    return t;
}

function extractAccessoryTermsFromText(text: string): string[] {
    const normalized = normalizeText(text);
    if (!normalized) return [];

    const found = new Set<string>();
    for (const term of ACCESSORY_TERMS) {
        const tn = normalizeText(term);
        if (tn && normalized.includes(tn)) {
            found.add(canonicalAccessoryTerm(tn));
        }
    }
    return Array.from(found);
}

// ========================================
// HELPER FUNCTIONS
// ========================================

/**
 * Normalize text for analysis (lowercase, strip accents, clean punctuation)
 */
function normalize(text: string): string {
    // Mantido por compatibilidade interna do arquivo, mas deve ser a mesma regra global
    return normalizeText(text);
}

/**
 * Extract model numbers from text (numbers with 3+ digits)
 */
function extractModelNumbers(text: string): string[] {
    const normalized = normalize(text);
    const tokens = normalized.split(/\s+/);
    const numbers: string[] = [];
    
    for (const token of tokens) {
        // Match numbers like: 510, 350, 1400, etc.
        // Also match: 510mm, cl510, 120l, etc.
        // IMPORTANT: require 3+ digits to reduce false positives.
        const match = token.match(/\d{3,}/);
        if (match) {
            numbers.push(match[0]);
        }
    }
    
    return numbers;
}

/**
 * Check if text contains any terms from a set
 */
function containsAnyTerm(text: string, terms: Set<string>): boolean {
    const normalized = normalize(text);
    for (const term of terms) {
        if (normalized.includes(term)) {
            return true;
        }
    }
    return false;
}

/**
 * Find main equipment category in text
 */
function findMainCategory(text: string): string {
    // No reranker, queremos categorias de negócio (enceradeira/lavadora/etc)
    return detectRerankerCategory(text) ?? 'UNKNOWN';
}

// ========================================
// CORE FUNCTIONS
// ========================================

/**
 * Parse query to extract intent and attributes
 * 
 * @param query - User's search query
 * @returns Parsed query with intent, category, model numbers, etc.
 */
export function parseQuery(query: string): ParsedQuery {
    const normalized = normalize(query);
    const tokens = normalized.split(/\s+/).filter(t => t.length > 0);
    
    // Extract model numbers
    const modelNumbers = extractModelNumbers(query);

    const accessoryTerms = extractAccessoryTermsFromText(query);

    const { category: mainCategory, index: categoryIndex } = findFirstCategoryTokenIndex(tokens);

    const firstAccessoryIndex = (() => {
        for (let i = 0; i < tokens.length; i++) {
            // Considera singular/plural (ex.: discos/escovas)
            const tok = tokens[i];
            if (ACCESSORY_TERMS.has(tok) || ACCESSORY_TERMS.has(tok + 's')) return i;
            if (tok.endsWith('s') && ACCESSORY_TERMS.has(tok.slice(0, -1))) return i;
        }
        return -1;
    })();

    let intent: QueryIntent = 'INDEFINIDO';

    if (mainCategory && firstAccessoryIndex !== -1) {
        // Se a categoria aparece antes (ou no mesmo ponto) do acessório => intenção de EQUIPAMENTO.
        // Caso contrário => intenção de ACESSORIO.
        intent = categoryIndex !== -1 && categoryIndex <= firstAccessoryIndex ? 'EQUIPAMENTO' : 'ACESSORIO';
    } else if (mainCategory) {
        intent = 'EQUIPAMENTO';
    } else if (firstAccessoryIndex !== -1) {
        intent = 'ACESSORIO';
    }
    
    return {
        intent,
        mainCategory,
        modelNumbers,
        accessoryTerms,
        tokens,
    };
}

/**
 * Classify document as equipment or accessory
 * 
 * @param docText - Document text (groupId, text, or rawText)
 * @param queryModelNumbers - Model numbers from query for matching
 * @returns Document classification
 */
export function classifyDoc(
    docInput: string | { text: string; docCategory?: string; docType?: DocType },
    queryModelNumbers: string[] = []
): DocClassification {
    const inputObj = typeof docInput === 'string' ? { text: docInput } : docInput;
    const docText = inputObj.text;
    const normalized = normalize(docText);
    
    // Check for accessory terms
    const hasAccessoryTerms = containsAnyTerm(docText, ACCESSORY_TERMS);
    
    // Check for equipment/category terms
    const detectedCategory = detectRerankerCategory(docText);
    const hasCategoryTerms = detectedCategory !== undefined;
    const category: any = (inputObj.docCategory as any) ?? detectedCategory;
    
    // Check for model number match
    let hasModelNumberMatch = false;
    if (queryModelNumbers.length > 0) {
        const docNumbers = extractModelNumbers(docText);
        hasModelNumberMatch = docNumbers.some(num => 
            queryModelNumbers.includes(num)
        );
    }
    
    // Classify document type (STRICT RULE): if doc has ANY accessory term, it's an accessory.
    // This avoids ambiguous phrasing like "disco ... para enceradeira" being misclassified.
    let docType: DocType = inputObj.docType ?? 'INDEFINIDO';
    if (inputObj.docType === undefined) {
        // Fallback: usar heurística do próprio reranker (mais ampla que a taxonomy)
        // - Se contém termo de acessório => ACESSORIO
        // - Senão, se contém categoria => EQUIPAMENTO
        // - Senão => INDEFINIDO
        docType = hasAccessoryTerms ? 'ACESSORIO' : hasCategoryTerms ? 'EQUIPAMENTO' : 'INDEFINIDO';
    }
    
    return {
        docType,
        category,
        hasAccessoryTerms,
        hasCategoryTerms,
        hasModelNumberMatch,
    };
}

/**
 * Rerank results with intent-based scoring
 * 
 * @param results - Array of results with id, score, and document text
 * @param parsedQuery - Parsed query with intent
 * @param maxScore - Maximum BM25 score for normalization
 * @param weights - Optional weight overrides for scoring
 * @returns Reranked results sorted by finalScore
 */
export function rerank(
    results: Array<{ id: string; score: number; text: string }>,
    parsedQuery: ParsedQuery,
    maxScore: number,
    weights?: {
        bm25Weight?: number;
        modelBoost?: number;
        categoryBoost?: number;
        accessoryPenalty?: number;
        missingModelPenalty?: number;
        accessoryBonusEnabled?: boolean;
    }
): RerankedResult[] {
    // Default weights (can be overridden by config)
    const w = {
        bm25Weight: weights?.bm25Weight ?? 0.35,
        modelBoost: weights?.modelBoost ?? 0.45,
        categoryBoost: weights?.categoryBoost ?? 0.30,
        accessoryPenalty: weights?.accessoryPenalty ?? 0.95,
        missingModelPenalty: weights?.missingModelPenalty ?? 0.55,
        accessoryBonusEnabled: weights?.accessoryBonusEnabled ?? true,
    };

    const reranked: RerankedResult[] = [];
    
    for (const result of results) {
        // Normalize BM25 score (0-1)
        const bm25Norm = maxScore > 0 ? result.score / maxScore : 0;
        
        // Classify document
        const anyResult: any = result as any;
        const classification = classifyDoc(
            {
                text: result.text,
                docCategory: anyResult.docCategory,
                docType: anyResult.docType,
            },
            parsedQuery.modelNumbers
        );
        
        // Calculate boosts and penalties
        let modelBoost = 0;
        let categoryBoost = 0;
        let accessoryPenalty = 0;
        let missingModelPenalty = 0;
        let accessoryBonus = 0;
        
        // Boost 1: Model number match
        if (classification.hasModelNumberMatch) {
            modelBoost = 1;
        }
        
        // Boost 2: Category match
        if (
            parsedQuery.mainCategory &&
            classification.category === parsedQuery.mainCategory
        ) {
            categoryBoost = 1;
        }
        
        // Penalty: Accessory when intent is EQUIPAMENTO
        if (parsedQuery.intent === 'EQUIPAMENTO' && classification.docType === 'ACESSORIO') {
            accessoryPenalty = 1;
        }
        
        // Penalty: Missing model number when query specifies a model
        if (parsedQuery.modelNumbers.length > 0 && !classification.hasModelNumberMatch) {
            missingModelPenalty = 1;
        }

        // Bonus: Accessory terms mentioned in EQUIPMENT docs (weak signal)
        if (
            w.accessoryBonusEnabled &&
            parsedQuery.accessoryTerms.length > 0 &&
            classification.docType === 'EQUIPAMENTO'
        ) {
            const normalized = normalize(result.text);
            let count = 0;
            for (const term of parsedQuery.accessoryTerms) {
                if (normalized.includes(term)) count++;
            }
            // Max 0.12 bonus (0.04 per accessory term, capped at 3 terms)
            accessoryBonus = Math.min(0.12, 0.04 * count);
        }
        
        // Calculate final score with configurable weights
        // Formula: bm25*W + model*W + cat*W + accBonus - accPen*W - missPen*W
        const finalScore = Math.max(
            0,
            w.bm25Weight * bm25Norm +
            w.modelBoost * modelBoost +
            w.categoryBoost * categoryBoost +
            accessoryBonus -
            w.accessoryPenalty * accessoryPenalty -
            w.missingModelPenalty * missingModelPenalty
        );
        
        reranked.push({
            id: result.id,
            bm25Norm,
            modelBoost,
            categoryBoost,
            accessoryPenalty,
            missingModelPenalty,
            accessoryBonus,
            finalScore,
            classification,
        });
    }
    
    // Sort by finalScore descending
    reranked.sort((a, b) => b.finalScore - a.finalScore);
    
    return reranked;
}

/**
 * Apply hard guard: force TOP1 to be EQUIPAMENTO when intent is EQUIPAMENTO
 * 
 * If top result is an accessory but there's an equipment document in topN,
 * swap them to ensure equipment appears first.
 * 
 * @param reranked - Already sorted reranked results
 * @param parsedQuery - Parsed query with intent
 * @param enabled - Whether hard guard is enabled
 * @returns { results, hardRuleApplied, hardRuleReason }
 */
export function applyHardTop1Guard(
    reranked: RerankedResult[],
    parsedQuery: ParsedQuery,
    enabled: boolean = true
): {
    results: RerankedResult[];
    hardRuleApplied: boolean;
    hardRuleReason?: string;
} {
    if (!enabled || reranked.length === 0) {
        return { results: reranked, hardRuleApplied: false };
    }

    // Only apply for EQUIPAMENTO intent
    if (parsedQuery.intent !== 'EQUIPAMENTO') {
        return { results: reranked, hardRuleApplied: false };
    }

    // Check if top1 is accessory
    const top1 = reranked[0];
    if (top1.classification.docType !== 'ACESSORIO') {
        return { results: reranked, hardRuleApplied: false }; // Already equipment
    }

    // Find first equipment in the list
    const firstEquipmentIdx = reranked.findIndex(r => r.classification.docType === 'EQUIPAMENTO');

    if (firstEquipmentIdx === -1) {
        // No equipment found in topN, can't apply guard
        return { results: reranked, hardRuleApplied: false };
    }

    // Swap: move equipment to position 0
    const newResults = [...reranked];
    const equipment = newResults[firstEquipmentIdx];
    newResults.splice(firstEquipmentIdx, 1);
    newResults.unshift(equipment);

    return {
        results: newResults,
        hardRuleApplied: true,
        hardRuleReason: `Intent=EQUIPAMENTO but top1 was ACESSORIO. Promoted first equipment from position ${firstEquipmentIdx + 1} to top1.`,
    };
}
