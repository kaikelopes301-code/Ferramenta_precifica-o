/**
 * 🔴 DEPRECATED – CÓDIGO LEGADO
 * 
 * Este módulo está obsoleto e foi substituído por:
 * - BM25 (src/domain/bm25.ts) para busca lexical
 * - SemanticSearchService (src/domain/semanticSearchService.ts) para busca semântica
 * - TsHybridEngine (src/domain/engines/tsHybridEngine.ts) para busca híbrida
 * 
 * RAZÃO: TF-IDF é inferior ao BM25 em termos de qualidade de ranking
 * STATUS: Preservado para referência histórica, não usar em código novo
 * DATA: Janeiro 2025
 * 
 * ============================================================================
 * 
 * TF-IDF Search Index for Cleaning Equipment
 *
 * This module implements TF-IDF search indices that mirror the Python implementation
 * in `backend/app/processamento/similarity.py`.
 *
 * Two index types:
 * 1. TfidfSearchIndex - Simple TF-IDF with character n-grams
 * 2. HybridTfidfSearchIndex - Char n-grams + word n-grams + token overlap
 *
 * Domain: Professional cleaning equipment (lavadoras, aspiradores, etc.)
 * NOT a generic industrial/motor catalog.
 */

import { stripAccents } from './normalization.js'

// =============================================================================
// Types
// =============================================================================

export interface TfidfDocument {
  id: string
  text: string
}

export interface TfidfResult {
  id: string
  score: number
}

export interface TfidfIndexConfig {
  analyzer?: 'char_wb' | 'word'
  ngramRange?: [number, number]
  maxFeatures?: number
}

export interface HybridTfidfConfig {
  ngramChar?: [number, number]
  ngramWord?: [number, number]
  wChar?: number
  wWord?: number
  wOverlap?: number
  anchorPenalty?: number
  anchorMinLen?: number
}

// =============================================================================
// Utility Functions (mirroring Python)
// =============================================================================

/**
 * Default preprocessing: lowercase and normalize whitespace
 * Mirrors Python `default_preprocess`
 */
export function defaultPreprocess(s: string): string {
  if (!s) return ''
  return s.trim().toLowerCase().split(/\s+/).join(' ')
}

/**
 * Simple tokenization: lowercase, strip accents, keep alphanumeric
 * Mirrors Python `simple_tokenize`
 */
export function simpleTokenize(s: string): string[] {
  const prep = defaultPreprocess(stripAccents(s))
  // Keep only alphanumeric, replace rest with space
  const cleaned = prep.replace(/[^a-z0-9]/g, ' ')
  return cleaned.split(/\s+/).filter((t) => t.length > 0)
}

/**
 * Generate character n-grams with word boundaries (char_wb)
 * Mirrors sklearn's char_wb analyzer
 */
export function charNgrams(text: string, minN: number, maxN: number): string[] {
  const ngrams: string[] = []
  const prep = defaultPreprocess(stripAccents(text))
  const words = prep.split(/\s+/).filter((w) => w.length > 0)

  for (const word of words) {
    // Add word boundary markers
    const padded = ` ${word} `
    for (let n = minN; n <= maxN; n++) {
      for (let i = 0; i <= padded.length - n; i++) {
        ngrams.push(padded.slice(i, i + n))
      }
    }
  }
  return ngrams
}

/**
 * Generate word n-grams
 */
export function wordNgrams(text: string, minN: number, maxN: number): string[] {
  const ngrams: string[] = []
  const tokens = simpleTokenize(text)

  for (let n = minN; n <= maxN; n++) {
    for (let i = 0; i <= tokens.length - n; i++) {
      ngrams.push(tokens.slice(i, i + n).join(' '))
    }
  }
  return ngrams
}

/**
 * Compute cosine similarity between two sparse vectors
 */
function cosineSimilarity(
  vec1: Map<string, number>,
  vec2: Map<string, number>
): number {
  let dot = 0
  let norm1 = 0
  let norm2 = 0

  for (const [term, w1] of vec1) {
    norm1 += w1 * w1
    const w2 = vec2.get(term) || 0
    dot += w1 * w2
  }

  for (const [, w2] of vec2) {
    norm2 += w2 * w2
  }

  if (norm1 === 0 || norm2 === 0) return 0
  return dot / (Math.sqrt(norm1) * Math.sqrt(norm2))
}

/**
 * L2 normalize a sparse vector
 */
function l2Normalize(vec: Map<string, number>): Map<string, number> {
  let norm = 0
  for (const [, w] of vec) {
    norm += w * w
  }
  norm = Math.sqrt(norm)
  if (norm === 0) return vec

  const result = new Map<string, number>()
  for (const [term, w] of vec) {
    result.set(term, w / norm)
  }
  return result
}

// =============================================================================
// TfidfSearchIndex - Simple TF-IDF with character n-grams
// =============================================================================

export class TfidfSearchIndex {
  private docIds: string[]
  private docVectors: Map<string, number>[]
  private idf: Map<string, number>
  private ngramRange: [number, number]
  private analyzer: 'char_wb' | 'word'

  private constructor(
    docIds: string[],
    docVectors: Map<string, number>[],
    idf: Map<string, number>,
    ngramRange: [number, number],
    analyzer: 'char_wb' | 'word'
  ) {
    this.docIds = docIds
    this.docVectors = docVectors
    this.idf = idf
    this.ngramRange = ngramRange
    this.analyzer = analyzer
  }

  /**
   * Build TF-IDF index from documents
   * Mirrors Python TfidfSearchIndex.build
   */
  static build(
    docs: TfidfDocument[],
    config: TfidfIndexConfig = {}
  ): TfidfSearchIndex {
    const analyzer = config.analyzer ?? 'char_wb'
    const ngramRange = config.ngramRange ?? [3, 5]

    const docIds = docs.map((d) => d.id)
    const N = docs.length

    // Step 1: Extract n-grams for each document and compute term frequencies
    const docTermFreqs: Map<string, number>[] = []
    const docFreq = new Map<string, number>() // DF: how many docs contain term

    for (const doc of docs) {
      const ngrams =
        analyzer === 'char_wb'
          ? charNgrams(doc.text, ngramRange[0], ngramRange[1])
          : wordNgrams(doc.text, ngramRange[0], ngramRange[1])

      // Count term frequencies in this document
      const tf = new Map<string, number>()
      for (const ng of ngrams) {
        tf.set(ng, (tf.get(ng) || 0) + 1)
      }
      docTermFreqs.push(tf)

      // Update document frequency
      for (const term of tf.keys()) {
        docFreq.set(term, (docFreq.get(term) || 0) + 1)
      }
    }

    // Step 2: Compute IDF for each term
    // IDF = log((N + 1) / (df + 1)) + 1  (sklearn's smooth_idf=True)
    const idf = new Map<string, number>()
    for (const [term, df] of docFreq) {
      idf.set(term, Math.log((N + 1) / (df + 1)) + 1)
    }

    // Step 3: Compute TF-IDF vectors (L2 normalized)
    const docVectors: Map<string, number>[] = []
    for (const tf of docTermFreqs) {
      const tfidf = new Map<string, number>()
      for (const [term, count] of tf) {
        const idfVal = idf.get(term) || 0
        tfidf.set(term, count * idfVal)
      }
      docVectors.push(l2Normalize(tfidf))
    }

    return new TfidfSearchIndex(docIds, docVectors, idf, ngramRange, analyzer)
  }

  /**
   * Transform query into TF-IDF vector
   */
  private queryVector(query: string): Map<string, number> {
    const ngrams =
      this.analyzer === 'char_wb'
        ? charNgrams(query, this.ngramRange[0], this.ngramRange[1])
        : wordNgrams(query, this.ngramRange[0], this.ngramRange[1])

    const tf = new Map<string, number>()
    for (const ng of ngrams) {
      if (this.idf.has(ng)) {
        // Only include terms that exist in vocabulary
        tf.set(ng, (tf.get(ng) || 0) + 1)
      }
    }

    const tfidf = new Map<string, number>()
    for (const [term, count] of tf) {
      const idfVal = this.idf.get(term) || 0
      tfidf.set(term, count * idfVal)
    }

    return l2Normalize(tfidf)
  }

  /**
   * Search for similar documents
   * Mirrors Python TfidfSearchIndex.search
   */
  search(query: string, topK: number = 10, minScore: number = 0): TfidfResult[] {
    const qv = this.queryVector(query)
    if (qv.size === 0) return []

    // Compute similarities
    const scores: { idx: number; score: number }[] = []
    for (let i = 0; i < this.docVectors.length; i++) {
      const docVec = this.docVectors[i]
      if (!docVec) continue
      const sim = cosineSimilarity(qv, docVec)
      if (sim >= minScore) {
        scores.push({ idx: i, score: sim })
      }
    }

    // Sort by score descending
    scores.sort((a, b) => b.score - a.score)

    // Return top K
    return scores.slice(0, topK).map((s) => ({
      id: this.docIds[s.idx]!,
      score: s.score,
    }))
  }
}

// =============================================================================
// HybridTfidfSearchIndex - Char + Word + Overlap (mirrors Python)
// =============================================================================

export class HybridTfidfSearchIndex {
  private docIds: string[]
  private charVectors: Map<string, number>[]
  private wordVectors: Map<string, number>[]
  private tokensPerDoc: Set<string>[]
  private idfMap: Map<string, number>
  private charIdf: Map<string, number>
  private wordIdf: Map<string, number>
  private ngramChar: [number, number]
  private ngramWord: [number, number]
  private wChar: number
  private wWord: number
  private wOverlap: number
  private anchorPenalty: number
  private anchorMinLen: number
  private headTokenPenalty: number

  private constructor(
    docIds: string[],
    charVectors: Map<string, number>[],
    wordVectors: Map<string, number>[],
    tokensPerDoc: Set<string>[],
    idfMap: Map<string, number>,
    charIdf: Map<string, number>,
    wordIdf: Map<string, number>,
    config: Required<HybridTfidfConfig>
  ) {
    this.docIds = docIds
    this.charVectors = charVectors
    this.wordVectors = wordVectors
    this.tokensPerDoc = tokensPerDoc
    this.idfMap = idfMap
    this.charIdf = charIdf
    this.wordIdf = wordIdf
    this.ngramChar = config.ngramChar
    this.ngramWord = config.ngramWord
    this.wChar = config.wChar
    this.wWord = config.wWord
    this.wOverlap = config.wOverlap
    this.anchorPenalty = config.anchorPenalty
    this.anchorMinLen = config.anchorMinLen
    this.headTokenPenalty = 0.9 // Fixed in Python
  }

  /**
   * Build hybrid TF-IDF index
   * Mirrors Python HybridTfidfSearchIndex.build
   */
  static build(
    docs: TfidfDocument[],
    config: HybridTfidfConfig = {}
  ): HybridTfidfSearchIndex {
    const ngramChar = config.ngramChar ?? [3, 5]
    const ngramWord = config.ngramWord ?? [1, 2]
    const wChar = config.wChar ?? 0.6
    const wWord = config.wWord ?? 0.25
    const wOverlap = config.wOverlap ?? 0.15
    const anchorPenalty = config.anchorPenalty ?? 0.8
    const anchorMinLen = config.anchorMinLen ?? 3

    const docIds = docs.map((d) => d.id)
    const N = docs.length

    // Build char n-gram vectors
    const charTermFreqs: Map<string, number>[] = []
    const charDocFreq = new Map<string, number>()

    for (const doc of docs) {
      const ngrams = charNgrams(doc.text, ngramChar[0], ngramChar[1])
      const tf = new Map<string, number>()
      for (const ng of ngrams) {
        tf.set(ng, (tf.get(ng) || 0) + 1)
      }
      charTermFreqs.push(tf)
      for (const term of tf.keys()) {
        charDocFreq.set(term, (charDocFreq.get(term) || 0) + 1)
      }
    }

    const charIdf = new Map<string, number>()
    for (const [term, df] of charDocFreq) {
      charIdf.set(term, Math.log((N + 1) / (df + 1)) + 1)
    }

    const charVectors: Map<string, number>[] = []
    for (const tf of charTermFreqs) {
      const tfidf = new Map<string, number>()
      for (const [term, count] of tf) {
        const idfVal = charIdf.get(term) || 0
        tfidf.set(term, count * idfVal)
      }
      charVectors.push(l2Normalize(tfidf))
    }

    // Build word n-gram vectors
    const wordTermFreqs: Map<string, number>[] = []
    const wordDocFreq = new Map<string, number>()

    for (const doc of docs) {
      const ngrams = wordNgrams(doc.text, ngramWord[0], ngramWord[1])
      const tf = new Map<string, number>()
      for (const ng of ngrams) {
        tf.set(ng, (tf.get(ng) || 0) + 1)
      }
      wordTermFreqs.push(tf)
      for (const term of tf.keys()) {
        wordDocFreq.set(term, (wordDocFreq.get(term) || 0) + 1)
      }
    }

    const wordIdf = new Map<string, number>()
    for (const [term, df] of wordDocFreq) {
      wordIdf.set(term, Math.log((N + 1) / (df + 1)) + 1)
    }

    const wordVectors: Map<string, number>[] = []
    for (const tf of wordTermFreqs) {
      const tfidf = new Map<string, number>()
      for (const [term, count] of tf) {
        const idfVal = wordIdf.get(term) || 0
        tfidf.set(term, count * idfVal)
      }
      wordVectors.push(l2Normalize(tfidf))
    }

    // Build tokens per document (for overlap scoring)
    const tokensPerDoc: Set<string>[] = []
    for (const doc of docs) {
      tokensPerDoc.push(new Set(simpleTokenize(doc.text)))
    }

    // IDF map for anchor tokens (from word vocabulary)
    const idfMap = new Map<string, number>()
    for (const [term, idf] of wordIdf) {
      // Word n-grams include single tokens
      if (!term.includes(' ')) {
        idfMap.set(term, idf)
      }
    }

    return new HybridTfidfSearchIndex(
      docIds,
      charVectors,
      wordVectors,
      tokensPerDoc,
      idfMap,
      charIdf,
      wordIdf,
      {
        ngramChar,
        ngramWord,
        wChar,
        wWord,
        wOverlap,
        anchorPenalty,
        anchorMinLen,
      }
    )
  }

  /**
   * Get anchor tokens from query (sorted by IDF, most rare first)
   */
  private anchorTokens(query: string): string[] {
    const tokens = simpleTokenize(query).filter(
      (t) => t.length >= this.anchorMinLen
    )

    // Sort by IDF descending (rarer = stronger anchor)
    tokens.sort((a, b) => {
      const idfA = this.idfMap.get(a) || 0
      const idfB = this.idfMap.get(b) || 0
      return idfB - idfA
    })

    // Special handling for 'mop' (domain-specific)
    if (tokens.includes('mop') && tokens[0] !== 'mop') {
      const mopIdx = tokens.indexOf('mop')
      tokens.splice(mopIdx, 1)
      tokens.unshift('mop')
    }

    return tokens.slice(0, 5)
  }

  /**
   * Get head token (first significant token)
   */
  private headToken(query: string): string | null {
    for (const t of simpleTokenize(query)) {
      if (t.length >= this.anchorMinLen && !/^\d+$/.test(t)) {
        return t
      }
    }
    return null
  }

  /**
   * Compute overlap score between query tokens and document tokens
   */
  private overlapScore(queryTokens: string[]): number[] {
    if (queryTokens.length === 0) {
      return new Array(this.tokensPerDoc.length).fill(0)
    }

    const qWeights = new Map<string, number>()
    let maxW = 0
    for (const t of queryTokens) {
      const w = this.idfMap.get(t) || 1.0
      qWeights.set(t, w)
      maxW += w
    }
    if (maxW === 0) maxW = 1

    const scores: number[] = []
    for (const docTokens of this.tokensPerDoc) {
      let s = 0
      for (const [t, w] of qWeights) {
        if (docTokens.has(t)) {
          s += w
        }
      }
      scores.push(s / maxW)
    }
    return scores
  }

  /**
   * Compute char n-gram TF-IDF query vector
   */
  private charQueryVector(query: string): Map<string, number> {
    const ngrams = charNgrams(query, this.ngramChar[0], this.ngramChar[1])
    const tf = new Map<string, number>()
    for (const ng of ngrams) {
      if (this.charIdf.has(ng)) {
        tf.set(ng, (tf.get(ng) || 0) + 1)
      }
    }
    const tfidf = new Map<string, number>()
    for (const [term, count] of tf) {
      tfidf.set(term, count * (this.charIdf.get(term) || 0))
    }
    return l2Normalize(tfidf)
  }

  /**
   * Compute word n-gram TF-IDF query vector
   */
  private wordQueryVector(query: string): Map<string, number> {
    const ngrams = wordNgrams(query, this.ngramWord[0], this.ngramWord[1])
    const tf = new Map<string, number>()
    for (const ng of ngrams) {
      if (this.wordIdf.has(ng)) {
        tf.set(ng, (tf.get(ng) || 0) + 1)
      }
    }
    const tfidf = new Map<string, number>()
    for (const [term, count] of tf) {
      tfidf.set(term, count * (this.wordIdf.get(term) || 0))
    }
    return l2Normalize(tfidf)
  }

  /**
   * Common prefix length helper
   */
  private commonPrefixLen(a: string, b: string): number {
    const m = Math.min(a.length, b.length)
    let i = 0
    while (i < m && a[i] === b[i]) {
      i++
    }
    return i
  }

  /**
   * Search for similar documents
   * Mirrors Python HybridTfidfSearchIndex.search (without autocorrection)
   */
  search(query: string, topK: number = 10, minScore: number = 0): TfidfResult[] {
    const qNorm = stripAccents(query)
    const qvChar = this.charQueryVector(qNorm)
    const qvWord = this.wordQueryVector(qNorm)

    // Compute char and word similarities
    const simsChar: number[] = []
    const simsWord: number[] = []
    for (let i = 0; i < this.charVectors.length; i++) {
      const charVec = this.charVectors[i]
      const wordVec = this.wordVectors[i]
      if (!charVec || !wordVec) continue
      simsChar.push(cosineSimilarity(qvChar, charVec))
      simsWord.push(cosineSimilarity(qvWord, wordVec))
    }

    // Anchor tokens and overlap
    const anchors = this.anchorTokens(qNorm)
    const overlap = this.overlapScore(anchors)

    // Query token count
    const qToks = simpleTokenize(qNorm)
    const singleTokenQuery = qToks.length <= 1

    // Weights (adjust for single-token queries)
    let wChar: number, wWord: number, wOverlap: number
    if (singleTokenQuery) {
      wChar = 0.75
      wWord = 0.15
      wOverlap = 0.1
    } else {
      wChar = this.wChar
      wWord = this.wWord
      wOverlap = this.wOverlap
    }

    // Combined score
    const scores: number[] = []
    for (let i = 0; i < this.charVectors.length; i++) {
      const sc = simsChar[i] ?? 0
      const sw = simsWord[i] ?? 0
      const ov = overlap[i] ?? 0
      scores.push(wChar * sc + wWord * sw + wOverlap * ov)
    }

    // Apply anchor penalty (only for multi-token queries)
    if (anchors.length > 0 && !singleTokenQuery) {
      for (let i = 0; i < scores.length; i++) {
        const tokensDoc = this.tokensPerDoc[i]
        if (!tokensDoc) continue
        const hasAnchor = anchors.some((a) => tokensDoc.has(a))
        if (!hasAnchor) {
          scores[i] = (scores[i] ?? 0) * (1.0 - this.anchorPenalty)
        }
      }
    }

    // Apply head token penalty
    const head = this.headToken(qNorm)
    if (head) {
      for (let i = 0; i < scores.length; i++) {
        const tokensDoc = this.tokensPerDoc[i]
        if (!tokensDoc) continue
        let hasHead = false
        if (singleTokenQuery) {
          // For single-token: check prefix/substring
          for (const t of tokensDoc) {
            if (t.length >= this.anchorMinLen) {
              if (
                head.includes(t) ||
                t.includes(head) ||
                this.commonPrefixLen(head, t) >= this.anchorMinLen
              ) {
                hasHead = true
                break
              }
            }
          }
          if (!hasHead) {
            const penalty = Math.max(0, Math.min(1, this.headTokenPenalty * 0.25))
            scores[i] = (scores[i] ?? 0) * (1.0 - penalty)
          }
        } else {
          hasHead = tokensDoc.has(head)
          if (!hasHead) {
            scores[i] = (scores[i] ?? 0) * (1.0 - this.headTokenPenalty)
          }
        }
      }
    }

    // Filter by min score and sort
    const results: { idx: number; score: number }[] = []
    for (let i = 0; i < scores.length; i++) {
      const sc = scores[i] ?? 0
      if (sc >= minScore) {
        results.push({ idx: i, score: sc })
      }
    }
    results.sort((a, b) => b.score - a.score)

    return results.slice(0, topK).map((r) => ({
      id: this.docIds[r.idx]!,
      score: r.score,
    }))
  }
}

// =============================================================================
// Factory function for convenience
// =============================================================================

export function buildTfidfIndex(
  docs: TfidfDocument[],
  type: 'simple' | 'hybrid' = 'hybrid',
  config?: TfidfIndexConfig | HybridTfidfConfig
): TfidfSearchIndex | HybridTfidfSearchIndex {
  if (type === 'simple') {
    return TfidfSearchIndex.build(docs, config as TfidfIndexConfig)
  }
  return HybridTfidfSearchIndex.build(docs, config as HybridTfidfConfig)
}
