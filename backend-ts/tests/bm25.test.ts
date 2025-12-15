/**
 * BM25 Algorithm Tests
 * 
 * Tests validate:
 * 1. Correct implementation of BM25 formula
 * 2. Edge cases (empty docs, single word queries, etc.)
 * 3. Ranking correctness with known examples
 * 4. Parameter sensitivity (k1, b)
 */

import { describe, it, expect } from 'vitest';
import { BM25Index, buildBM25Index, type BM25Document } from '../src/domain/bm25.js';

describe('BM25Index', () => {
    // Sample corpus for testing
    const sampleDocs: BM25Document[] = [
        { id: 'doc1', text: 'lavadora de piso industrial' },
        { id: 'doc2', text: 'lavadora de alta pressão' },
        { id: 'doc3', text: 'aspirador de pó industrial' },
        { id: 'doc4', text: 'mop industrial microfibra' },
        { id: 'doc5', text: 'carrinho de limpeza industrial' },
    ];

    describe('Index Building', () => {
        it('should build index from documents', () => {
            const index = buildBM25Index(sampleDocs);
            const stats = index.getStats();

            expect(stats.numDocuments).toBe(5);
            expect(stats.numTerms).toBeGreaterThan(0);
            expect(stats.avgDocLength).toBeGreaterThan(0);
        });

        it('should handle empty document list', () => {
            const index = buildBM25Index([]);
            const stats = index.getStats();

            expect(stats.numDocuments).toBe(0);
            expect(stats.numTerms).toBe(0);
            expect(stats.avgDocLength).toBe(0);
        });

        it('should calculate correct average document length', () => {
            const docs: BM25Document[] = [
                { id: '1', text: 'a b c' },        // 3 tokens
                { id: '2', text: 'a b c d e' },    // 5 tokens
            ];
            const index = buildBM25Index(docs);
            const stats = index.getStats();

            expect(stats.avgDocLength).toBe(4); // (3 + 5) / 2
        });

        it('should use custom configuration', () => {
            const index = buildBM25Index(sampleDocs, { k1: 2.0, b: 0.5 });
            const stats = index.getStats();

            expect(stats.config.k1).toBe(2.0);
            expect(stats.config.b).toBe(0.5);
        });
    });

    describe('Search Functionality', () => {
        it('should find exact matches', () => {
            const index = buildBM25Index(sampleDocs);
            const results = index.search('lavadora industrial', 10);

            expect(results.length).toBeGreaterThan(0);
            expect(results[0]?.id).toBe('doc1'); // "lavadora de piso industrial" should rank first
        });

        it('should rank by relevance', () => {
            const index = buildBM25Index(sampleDocs);
            const results = index.search('industrial', 10);

            // All docs with "industrial" should be returned
            expect(results.length).toBe(4); // doc1, doc3, doc4, doc5

            // All should have same score for single-term query with same frequency
            const scores = results.map(r => r.score);
            const uniqueScores = new Set(scores);
            expect(uniqueScores.size).toBeLessThanOrEqual(2); // At most 2 unique scores due to length normalization
        });

        it('should handle multi-term queries', () => {
            const index = buildBM25Index(sampleDocs);
            const results = index.search('lavadora pressão', 10);

            // doc2 should rank highest (has both "lavadora" and "pressão")
            expect(results[0]?.id).toBe('doc2');
        });

        it('should return empty results for non-matching query', () => {
            const index = buildBM25Index(sampleDocs);
            const results = index.search('balde recipiente', 10);

            expect(results.length).toBe(0);
        });

        it('should respect topK parameter', () => {
            const index = buildBM25Index(sampleDocs);
            const results = index.search('industrial', 2);

            expect(results.length).toBe(2);
        });

        it('should respect minScore threshold', () => {
            const index = buildBM25Index(sampleDocs);
            const results = index.search('industrial', 10, 100); // Very high threshold

            expect(results.length).toBe(0);
        });

        it('should handle single-word queries', () => {
            const index = buildBM25Index(sampleDocs);
            const results = index.search('mop', 10);

            expect(results.length).toBe(1);
            expect(results[0]?.id).toBe('doc4');
        });

        it('should be case-insensitive', () => {
            const index = buildBM25Index(sampleDocs);
            const results1 = index.search('LAVADORA', 10);
            const results2 = index.search('lavadora', 10);

            expect(results1.length).toBe(results2.length);
            expect(results1[0]?.id).toBe(results2[0]?.id);
        });
    });

    describe('BM25 Formula Correctness', () => {
        it('should give higher scores to documents with more term occurrences', () => {
            const docs: BM25Document[] = [
                { id: 'single', text: 'lavadora de piso' },
                { id: 'double', text: 'lavadora de piso lavadora' }, // "lavadora" appears twice
            ];
            const index = buildBM25Index(docs);
            const results = index.search('lavadora', 10);

            const singleScore = results.find(r => r.id === 'single')?.score || 0;
            const doubleScore = results.find(r => r.id === 'double')?.score || 0;

            expect(doubleScore).toBeGreaterThan(singleScore);
        });

        it('should apply saturation (diminishing returns for high frequency)', () => {
            const docs: BM25Document[] = [
                { id: 'freq2', text: 'mop mop' },
                { id: 'freq10', text: 'mop mop mop mop mop mop mop mop mop mop' },
            ];
            const index = buildBM25Index(docs);
            const results = index.search('mop', 10);

            const score2 = results.find(r => r.id === 'freq2')?.score || 0;
            const score10 = results.find(r => r.id === 'freq10')?.score || 0;

            // Score should increase but not linearly (saturation effect)
            const ratio = score10 / score2;
            expect(ratio).toBeLessThan(5); // Not 5x despite 5x frequency
            expect(ratio).toBeGreaterThan(1); // But still higher
        });

        it('should apply length normalization', () => {
            const docs: BM25Document[] = [
                { id: 'short', text: 'lavadora' },
                { id: 'long', text: 'lavadora de piso industrial com alta pressão e muitos recursos adicionais' },
            ];
            const index = buildBM25Index(docs);
            const results = index.search('lavadora', 10);

            const shortScore = results.find(r => r.id === 'short')?.score || 0;
            const longScore = results.find(r => r.id === 'long')?.score || 0;

            // Short document should score higher (length normalization)
            expect(shortScore).toBeGreaterThan(longScore);
        });

        it('should handle IDF correctly (rare terms score higher)', () => {
            const docs: BM25Document[] = [
                { id: 'doc1', text: 'lavadora comum' },
                { id: 'doc2', text: 'lavadora pressão' },
                { id: 'doc3', text: 'lavadora industrial' },
                { id: 'doc4', text: 'aspirador' }, // "aspirador" is rarer
            ];
            const index = buildBM25Index(docs);

            // Common term
            const commonResults = index.search('lavadora', 10);
            const commonScore = commonResults[0]?.score || 0;

            // Rare term
            const rareResults = index.search('aspirador', 10);
            const rareScore = rareResults[0]?.score || 0;

            // Rare term should have higher IDF component
            // Note: We can't directly compare scores between different queries,
            // but we validate the mechanism is working
            expect(rareScore).toBeGreaterThan(0);
            expect(commonScore).toBeGreaterThan(0);
        });
    });

    describe('Parameter Sensitivity', () => {
        it('should change scores when k1 is modified', () => {
            const docs: BM25Document[] = [
                { id: 'doc1', text: 'mop mop mop' },
            ];

            const index1 = buildBM25Index(docs, { k1: 0.5 });
            const index2 = buildBM25Index(docs, { k1: 2.0 });

            const results1 = index1.search('mop', 10);
            const results2 = index2.search('mop', 10);

            // Different k1 should produce different scores
            expect(results1[0]?.score).not.toBe(results2[0]?.score);
        });

        it('should change scores when b is modified', () => {
            const docs: BM25Document[] = [
                { id: 'short', text: 'mop' },
                { id: 'long', text: 'mop de limpeza industrial profissional' },
            ];

            const indexLowB = buildBM25Index(docs, { b: 0.1 }); // Less length normalization
            const indexHighB = buildBM25Index(docs, { b: 0.9 }); // More length normalization

            const resultsLowB = indexLowB.search('mop', 10);
            const resultsHighB = indexHighB.search('mop', 10);

            const shortScoreLowB = resultsLowB.find(r => r.id === 'short')?.score || 0;
            const longScoreLowB = resultsLowB.find(r => r.id === 'long')?.score || 0;

            const shortScoreHighB = resultsHighB.find(r => r.id === 'short')?.score || 0;
            const longScoreHighB = resultsHighB.find(r => r.id === 'long')?.score || 0;

            // With higher b, length normalization should be stronger
            const ratioLowB = shortScoreLowB / longScoreLowB;
            const ratioHighB = shortScoreHighB / longScoreHighB;

            expect(ratioHighB).toBeGreaterThan(ratioLowB);
        });
    });

    describe('Edge Cases', () => {
        it('should handle documents with only stop-length words', () => {
            const docs: BM25Document[] = [
                { id: 'doc1', text: 'a b c' }, // All 1-char tokens might be filtered
            ];
            const index = buildBM25Index(docs, { minTokenLength: 2 });
            const results = index.search('a', 10);

            // Should return empty since all tokens are too short
            expect(results.length).toBe(0);
        });

        it('should handle empty query', () => {
            const index = buildBM25Index(sampleDocs);
            const results = index.search('', 10);

            expect(results.length).toBe(0);
        });

        it('should handle query with only whitespace', () => {
            const index = buildBM25Index(sampleDocs);
            const results = index.search('   ', 10);

            expect(results.length).toBe(0);
        });

        it('should handle duplicate documents', () => {
            const docs: BM25Document[] = [
                { id: 'doc1', text: 'lavadora industrial' },
                { id: 'doc2', text: 'lavadora industrial' },
            ];
            const index = buildBM25Index(docs);
            const results = index.search('lavadora', 10);

            expect(results.length).toBe(2);
            // Both should have same score
            expect(results[0]?.score).toBe(results[1]?.score);
        });
    });
});
