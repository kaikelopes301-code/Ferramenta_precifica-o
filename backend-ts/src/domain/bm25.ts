// ⚠️ CORE SEARCH COMPONENT – NÃO REMOVER ESTE ARQUIVO
// Este módulo faz parte do núcleo da engine de busca TypeScript.
// Responsável por: algoritmo BM25 para busca lexical (superior ao TF-IDF para documentos curtos).
// Usado por: integratedSearch, tsHybridEngine (via TF-IDF/BM25 hybrid).

/**
 * BM25 (Okapi BM25) Search Algorithm
 * 
 * BM25 is a probabilistic ranking function used for information retrieval.
 * It's superior to TF-IDF for short documents (like product descriptions).
 * 
 * Formula:
 * BM25(D, Q) = Σ IDF(qi) * (f(qi, D) * (k1 + 1)) / (f(qi, D) + k1 * (1 - b + b * |D| / avgdl))
 * 
 * Where:
 * - D = document
 * - Q = query
 * - f(qi, D) = frequency of term qi in document D
 * - |D| = length of document D
 * - avgdl = average document length in collection
 * - k1 = term frequency saturation parameter (typically 1.2-2.0)
 * - b = length normalization parameter (typically 0.75)
 * - IDF(qi) = inverse document frequency of term qi
 * 
 * References:
 * - Robertson, S., & Zaragoza, H. (2009). The Probabilistic Relevance Framework: BM25 and Beyond
 * - https://en.wikipedia.org/wiki/Okapi_BM25
 */

/**
 * BM25 configuration parameters
 */
export interface BM25Config {
    /** Term frequency saturation parameter (default: 1.5) */
    k1?: number;
    /** Length normalization parameter (default: 0.75) */
    b?: number;
    /** Minimum token length to index (default: 2) */
    minTokenLength?: number;
}

const DEFAULT_CONFIG: Required<BM25Config> = {
    k1: 1.5,
    b: 0.75,
    minTokenLength: 2,
};

/**
 * Document for BM25 indexing
 */
export interface BM25Document {
    id: string;
    text: string;
}

/**
 * Search result from BM25
 */
export interface BM25Result {
    id: string;
    score: number;
}

/**
 * Tokenize text into terms (simple whitespace + lowercase)
 */
function tokenize(text: string): string[] {
    return text
        .toLowerCase()
        .split(/\s+/)
        .filter(token => token.length > 0);
}

/**
 * BM25 Index Class
 * 
 * Builds and maintains inverted index for BM25 scoring
 */
export class BM25Index {
    private docIds: string[] = [];
    private docLengths: number[] = [];
    private avgDocLength: number = 0;
    private termDocFreq: Map<string, number> = new Map(); // DF: num docs containing term
    private invertedIndex: Map<string, Map<number, number>> = new Map(); // term -> {docIdx: freq}
    private config: Required<BM25Config>;
    private N: number = 0; // Total number of documents

    constructor(config: BM25Config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Build BM25 index from documents
     */
    static build(documents: BM25Document[], config: BM25Config = {}): BM25Index {
        const index = new BM25Index(config);

        // Step 1: Tokenize all documents and build inverted index
        let totalLength = 0;

        for (let docIdx = 0; docIdx < documents.length; docIdx++) {
            const doc = documents[docIdx]!;
            index.docIds.push(doc.id);

            const tokens = tokenize(doc.text);
            const termFreqs = new Map<string, number>();

            // Count term frequencies in this document
            for (const token of tokens) {
                if (token.length < index.config.minTokenLength) continue;
                termFreqs.set(token, (termFreqs.get(token) || 0) + 1);
            }

            // Store document length
            const docLength = tokens.length;
            index.docLengths.push(docLength);
            totalLength += docLength;

            // Update inverted index and document frequency
            for (const [term, freq] of termFreqs) {
                // Update document frequency
                index.termDocFreq.set(term, (index.termDocFreq.get(term) || 0) + 1);

                // Update inverted index
                if (!index.invertedIndex.has(term)) {
                    index.invertedIndex.set(term, new Map());
                }
                index.invertedIndex.get(term)!.set(docIdx, freq);
            }
        }

        // Step 2: Calculate average document length
        index.N = documents.length;
        index.avgDocLength = index.N > 0 ? totalLength / index.N : 0;

        return index;
    }

    /**
     * Calculate IDF (Inverse Document Frequency) for a term
     * 
     * IDF = log((N - df + 0.5) / (df + 0.5) + 1)
     * 
     * This is the Robertson-Zaragoza IDF formula with +1 smoothing
     */
    private idf(term: string): number {
        const df = this.termDocFreq.get(term) || 0;

        if (df === 0) return 0;

        // Robertson-Zaragoza IDF
        const numerator = this.N - df + 0.5;
        const denominator = df + 0.5;

        return Math.log(numerator / denominator + 1);
    }

    /**
     * Calculate BM25 score for a single term in a document
     * 
     * score = IDF(term) * (f * (k1 + 1)) / (f + k1 * (1 - b + b * (docLen / avgDocLen)))
     */
    private termScore(term: string, docIdx: number): number {
        const postings = this.invertedIndex.get(term);
        if (!postings) return 0;

        const termFreq = postings.get(docIdx);
        if (!termFreq) return 0;

        const docLen = this.docLengths[docIdx] || 0;
        const idf = this.idf(term);

        const { k1, b } = this.config;
        const avgDocLen = this.avgDocLength;

        // BM25 formula
        const numerator = termFreq * (k1 + 1);
        const denominator = termFreq + k1 * (1 - b + b * (docLen / avgDocLen));

        return idf * (numerator / denominator);
    }

    /**
     * Search using BM25 scoring
     * 
     * @param query - Search query string
     * @param topK - Number of top results to return (default: 10)
     * @param minScore - Minimum score threshold (default: 0)
     * @returns Array of results sorted by score descending
     */
    search(query: string, topK: number = 10, minScore: number = 0): BM25Result[] {
        const queryTerms = tokenize(query).filter(
            token => token.length >= this.config.minTokenLength
        );

        if (queryTerms.length === 0) {
            return [];
        }

        // Calculate scores for each document
        const scores = new Map<number, number>();

        for (const term of queryTerms) {
            const postings = this.invertedIndex.get(term);
            if (!postings) continue;

            // For each document containing this term
            for (const [docIdx, _] of postings) {
                const termScore = this.termScore(term, docIdx);
                scores.set(docIdx, (scores.get(docIdx) || 0) + termScore);
            }
        }

        // Convert to results array
        const results: BM25Result[] = [];
        for (const [docIdx, score] of scores) {
            if (score >= minScore) {
                results.push({
                    id: this.docIds[docIdx]!,
                    score,
                });
            }
        }

        // Sort by score descending and return top K
        results.sort((a, b) => b.score - a.score);
        return results.slice(0, topK);
    }

    /**
     * Get statistics about the index
     */
    getStats(): {
        numDocuments: number;
        numTerms: number;
        avgDocLength: number;
        config: Required<BM25Config>;
    } {
        return {
            numDocuments: this.N,
            numTerms: this.termDocFreq.size,
            avgDocLength: this.avgDocLength,
            config: this.config,
        };
    }

    /**
     * Get document by ID
     */
    getDocumentId(index: number): string | undefined {
        return this.docIds[index];
    }

    /**
     * Get total number of documents
     */
    get documentCount(): number {
        return this.N;
    }

    /**
     * Serialize index to JSON object
     */
    toJSON(): any {
        return {
            docIds: this.docIds,
            docLengths: this.docLengths,
            avgDocLength: this.avgDocLength,
            termDocFreq: Array.from(this.termDocFreq.entries()),
            invertedIndex: Array.from(this.invertedIndex.entries()).map(([term, docMap]) => [
                term,
                Array.from(docMap.entries())
            ]),
            config: this.config,
            N: this.N
        };
    }

    /**
     * Load index from JSON object (skips building)
     */
    static fromJSON(json: any): BM25Index {
        const index = new BM25Index(json.config);

        index.docIds = json.docIds;
        index.docLengths = json.docLengths;
        index.avgDocLength = json.avgDocLength;
        index.termDocFreq = new Map(json.termDocFreq);

        // Reconstruct nested map
        index.invertedIndex = new Map(
            json.invertedIndex.map(([term, docEntries]: [string, [number, number][]]) => [
                term,
                new Map(docEntries)
            ])
        );

        index.N = json.N;

        return index;
    }
}

/**
 * Factory function to create BM25 index
 */
export function buildBM25Index(
    documents: BM25Document[],
    config?: BM25Config
): BM25Index {
    return BM25Index.build(documents, config);
}
