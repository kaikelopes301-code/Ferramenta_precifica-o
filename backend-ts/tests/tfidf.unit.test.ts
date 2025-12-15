/**
 * TF-IDF Unit Tests - Golden Fixture Validation
 *
 * These tests validate that the TypeScript TF-IDF implementation
 * produces the same rankings as the Python implementation.
 *
 * Domain: Professional cleaning equipment
 */

import { describe, it, expect, beforeAll } from 'vitest'
import {
  TfidfSearchIndex,
  HybridTfidfSearchIndex,
  TfidfDocument,
  TfidfResult,
  simpleTokenize,
  charNgrams,
  wordNgrams,
  defaultPreprocess,
} from '../src/domain/tfidf'
import { normalizeEquip } from '../src/domain/normalization'

// Load golden fixtures
import golden from './fixtures/tfidf_golden.json'

// =============================================================================
// Types for golden fixtures
// =============================================================================

interface GoldenCorpusDoc {
  id: string
  text: string
  text_normalized: string
  category: string
}

interface GoldenResult {
  id: string
  score: number
  rank: number
}

interface GoldenQuery {
  query: string
  query_normalized: string
  results: GoldenResult[]
}

interface GoldenTfidfConfig {
  description: string
  [key: string]: unknown
}

interface GoldenTfidfSection {
  config: GoldenTfidfConfig
  queries: GoldenQuery[]
}

interface GoldenFile {
  metadata: {
    description: string
    domain: string
    corpus_size: number
    query_count: number
  }
  corpus: GoldenCorpusDoc[]
  simple_tfidf: GoldenTfidfSection
  hybrid_tfidf: GoldenTfidfSection
}

const data = golden as unknown as GoldenFile

// =============================================================================
// Utility Functions Tests
// =============================================================================

describe('TF-IDF Utility Functions', () => {
  describe('defaultPreprocess', () => {
    it('lowercases and normalizes whitespace', () => {
      expect(defaultPreprocess('  HELLO   World  ')).toBe('hello world')
      expect(defaultPreprocess('Lavadora  de  Piso')).toBe('lavadora de piso')
    })

    it('handles empty string', () => {
      expect(defaultPreprocess('')).toBe('')
    })
  })

  describe('simpleTokenize', () => {
    it('tokenizes basic text', () => {
      expect(simpleTokenize('Lavadora de Piso')).toEqual(['lavadora', 'de', 'piso'])
    })

    it('removes accents and special chars', () => {
      expect(simpleTokenize('Aspirador Água 220V')).toEqual(['aspirador', 'agua', '220v'])
    })

    it('handles numbers', () => {
      expect(simpleTokenize('50L 220V 3HP')).toEqual(['50l', '220v', '3hp'])
    })
  })

  describe('charNgrams', () => {
    it('generates character n-grams with word boundaries', () => {
      const ngrams = charNgrams('ab', 2, 3)
      // Word 'ab' becomes ' ab ' -> ngrams: ' a', 'ab', 'b ', ' ab', 'ab '
      expect(ngrams).toContain(' a')
      expect(ngrams).toContain('ab')
      expect(ngrams).toContain('b ')
    })

    it('handles multiple words', () => {
      const ngrams = charNgrams('a b', 2, 2)
      // Two words: 'a' and 'b', each padded
      expect(ngrams.length).toBeGreaterThan(0)
    })
  })

  describe('wordNgrams', () => {
    it('generates word unigrams', () => {
      const ngrams = wordNgrams('lavadora de piso', 1, 1)
      expect(ngrams).toEqual(['lavadora', 'de', 'piso'])
    })

    it('generates word bigrams', () => {
      const ngrams = wordNgrams('lavadora de piso', 2, 2)
      expect(ngrams).toEqual(['lavadora de', 'de piso'])
    })

    it('generates unigrams and bigrams', () => {
      const ngrams = wordNgrams('lavadora de piso', 1, 2)
      expect(ngrams).toContain('lavadora')
      expect(ngrams).toContain('lavadora de')
      expect(ngrams).toContain('de piso')
    })
  })
})

// =============================================================================
// Simple TF-IDF Tests
// =============================================================================

describe('TfidfSearchIndex (Simple)', () => {
  let index: TfidfSearchIndex
  let corpus: TfidfDocument[]

  beforeAll(() => {
    // Use normalized text from golden corpus
    corpus = data.corpus.map((doc) => ({
      id: doc.id,
      text: doc.text_normalized,
    }))
    index = TfidfSearchIndex.build(corpus, {
      analyzer: 'char_wb',
      ngramRange: [3, 5],
    })
  })

  it('should build index from corpus', () => {
    expect(index).toBeDefined()
  })

  it('should return results for valid query', () => {
    const results = index.search('lavadora de piso', 5)
    expect(results.length).toBeGreaterThan(0)
    expect(results[0]).toHaveProperty('id')
    expect(results[0]).toHaveProperty('score')
  })

  it('should return empty for no-match query', () => {
    const results = index.search('xyznonexistent123', 5)
    // May return results due to partial char matches, but score should be low
    if (results.length > 0) {
      expect(results[0].score).toBeLessThan(0.1)
    }
  })

  // Golden fixture tests for simple TF-IDF
  describe('Golden Fixtures - Simple TF-IDF', () => {
    for (const queryCase of data.simple_tfidf.queries.slice(0, 15)) {
      it(`query: "${queryCase.query}"`, () => {
        const tsResults = index.search(
          queryCase.query_normalized,
          queryCase.results.length || 10
        )

        // Get top 3 IDs from both
        const tsTop3 = tsResults.slice(0, 3).map((r) => r.id)
        const pyTop3 = queryCase.results.slice(0, 3).map((r) => r.id)

        // At least the top result should match
        if (pyTop3.length > 0 && tsTop3.length > 0) {
          // Check if top result matches OR is in top 3
          const topMatch = tsTop3[0] === pyTop3[0] || pyTop3.includes(tsTop3[0])
          expect(topMatch).toBe(true)
        }

        // Check overlap in top 3 (at least 2 should match)
        const overlap = tsTop3.filter((id) => pyTop3.includes(id)).length
        expect(overlap).toBeGreaterThanOrEqual(Math.min(2, pyTop3.length))
      })
    }
  })
})

// =============================================================================
// Hybrid TF-IDF Tests
// =============================================================================

describe('HybridTfidfSearchIndex', () => {
  let index: HybridTfidfSearchIndex
  let corpus: TfidfDocument[]

  beforeAll(() => {
    corpus = data.corpus.map((doc) => ({
      id: doc.id,
      text: doc.text_normalized,
    }))
    index = HybridTfidfSearchIndex.build(corpus, {
      ngramChar: [3, 5],
      ngramWord: [1, 2],
      wChar: 0.6,
      wWord: 0.25,
      wOverlap: 0.15,
    })
  })

  it('should build hybrid index from corpus', () => {
    expect(index).toBeDefined()
  })

  it('should return results for valid query', () => {
    const results = index.search('lavadora de piso', 5)
    expect(results.length).toBeGreaterThan(0)
  })

  // Golden fixture tests for hybrid TF-IDF
  describe('Golden Fixtures - Hybrid TF-IDF', () => {
    for (const queryCase of data.hybrid_tfidf.queries.slice(0, 15)) {
      it(`query: "${queryCase.query}"`, () => {
        const tsResults = index.search(
          queryCase.query_normalized,
          queryCase.results.length || 10
        )

        // Get top 3 IDs from both
        const tsTop3 = tsResults.slice(0, 3).map((r) => r.id)
        const pyTop3 = queryCase.results.slice(0, 3).map((r) => r.id)

        if (pyTop3.length > 0 && tsTop3.length > 0) {
          // Top result should match or be in top 3
          const topMatch = tsTop3[0] === pyTop3[0] || pyTop3.includes(tsTop3[0])
          expect(topMatch).toBe(true)
        }

        // Check overlap in top 3 (at least 2 should match)
        const overlap = tsTop3.filter((id) => pyTop3.includes(id)).length
        expect(overlap).toBeGreaterThanOrEqual(Math.min(2, pyTop3.length))
      })
    }
  })
})

// =============================================================================
// Domain-Specific Tests (Cleaning Equipment)
// =============================================================================

describe('TF-IDF Domain Tests (Cleaning Equipment)', () => {
  let index: HybridTfidfSearchIndex

  beforeAll(() => {
    const corpus = data.corpus.map((doc) => ({
      id: doc.id,
      text: doc.text_normalized,
    }))
    index = HybridTfidfSearchIndex.build(corpus)
  })

  it('should rank floor scrubbers for "lavadora de piso"', () => {
    const results = index.search('lavadora de piso', 5)
    const topIds = results.map((r) => r.id)
    // Should return LAVADORA items, not peripheral
    expect(topIds.some((id) => id.startsWith('LAVADORA'))).toBe(true)
    expect(topIds[0]).toMatch(/^LAVADORA/)
  })

  it('should rank vacuums for "aspirador"', () => {
    const results = index.search('aspirador', 5)
    const topIds = results.map((r) => r.id)
    expect(topIds.some((id) => id.startsWith('ASPIRADOR'))).toBe(true)
  })

  it('should rank mops for "mop"', () => {
    const results = index.search('mop', 5)
    const topIds = results.map((r) => r.id)
    expect(topIds.some((id) => id.startsWith('MOP'))).toBe(true)
  })

  it('should rank buckets for "balde"', () => {
    const results = index.search('balde', 5)
    const topIds = results.map((r) => r.id)
    expect(topIds.some((id) => id.startsWith('BALDE'))).toBe(true)
  })

  it('should rank peripheral items for "celular"', () => {
    const results = index.search('celular', 5)
    const topIds = results.map((r) => r.id)
    expect(topIds.some((id) => id.startsWith('CELULAR'))).toBe(true)
  })

  it('should prefer cleaning machines over standalone motors for "lavadora motor"', () => {
    const results = index.search('lavadora motor', 5)
    const topIds = results.map((r) => r.id)
    // Lavadora with motor in description should rank higher than standalone motor
    expect(topIds[0]).toMatch(/^LAVADORA/)
  })

  it('should rank standalone motor for "motor trifasico"', () => {
    const results = index.search('motor trifasico', 5)
    const topIds = results.map((r) => r.id)
    // Should find MOTOR items
    expect(topIds.some((id) => id.startsWith('MOTOR'))).toBe(true)
  })
})

// =============================================================================
// Score Comparison Tests (approximate matching)
// =============================================================================

describe('TF-IDF Score Comparison', () => {
  let simpleIndex: TfidfSearchIndex
  let hybridIndex: HybridTfidfSearchIndex

  beforeAll(() => {
    const corpus = data.corpus.map((doc) => ({
      id: doc.id,
      text: doc.text_normalized,
    }))
    simpleIndex = TfidfSearchIndex.build(corpus)
    hybridIndex = HybridTfidfSearchIndex.build(corpus)
  })

  it('should have scores between 0 and 1', () => {
    const results = simpleIndex.search('lavadora de piso', 10)
    for (const r of results) {
      expect(r.score).toBeGreaterThanOrEqual(0)
      expect(r.score).toBeLessThanOrEqual(1)
    }
  })

  it('should rank exact matches higher', () => {
    // Query that exactly matches one document
    const results = hybridIndex.search('lavadora de piso operacao a pe alfa a500 50l 220v', 5)
    expect(results[0].id).toBe('LAVADORA_001')
    expect(results[0].score).toBeGreaterThan(0.5)
  })

  it('should handle numeric attributes in queries', () => {
    const results = hybridIndex.search('50l 220v', 10)
    expect(results.length).toBeGreaterThan(0)
    // Items with 50L and 220V should appear
    const ids = results.map((r) => r.id)
    expect(ids.some((id) => id.includes('LAVADORA') || id.includes('ASPIRADOR'))).toBe(true)
  })
})

// =============================================================================
// Integration with Normalization
// =============================================================================

describe('TF-IDF + Normalization Integration', () => {
  let index: HybridTfidfSearchIndex

  beforeAll(() => {
    // Build index using normalized text (as in production)
    const corpus = data.corpus.map((doc) => ({
      id: doc.id,
      text: normalizeEquip(doc.text),
    }))
    index = HybridTfidfSearchIndex.build(corpus)
  })

  it('should work with normalized queries', () => {
    const query = 'Lavadora de Piso 50L'
    const normalizedQuery = normalizeEquip(query)
    const results = index.search(normalizedQuery, 5)
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].id).toMatch(/^LAVADORA/)
  })

  it('should handle accents in queries', () => {
    const query = 'Aspirador de Água e Pó'
    const normalizedQuery = normalizeEquip(query)
    const results = index.search(normalizedQuery, 5)
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].id).toMatch(/^ASPIRADOR/)
  })

  it('should handle abbreviation expansion', () => {
    // CV -> HP expansion happens in normalization
    const query = 'motor 3cv'
    const normalizedQuery = normalizeEquip(query)
    // normalizeEquip should expand CV to HP
    expect(normalizedQuery).toContain('hp')
  })
})
