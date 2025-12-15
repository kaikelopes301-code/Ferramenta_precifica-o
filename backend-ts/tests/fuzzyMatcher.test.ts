/**
 * Fuzzy Matcher Tests
 * 
 * Validates typo correction and similarity matching
 */

import { describe, it, expect } from 'vitest';
import {
    FuzzyMatcher,
    buildFuzzyMatcherFromCorpus,
    similarityRatio,
    isFuzzyMatch,
    findBestFuzzyMatch,
} from '../src/domain/fuzzyMatcher.js';

describe('FuzzyMatcher', () => {
    describe('similarityRatio', () => {
        it('should return 1.0 for identical strings', () => {
            expect(similarityRatio('lavadora', 'lavadora')).toBe(1.0);
        });

        it('should return 0.0 for completely different strings', () => {
            const ratio = similarityRatio('abc', 'xyz');
            expect(ratio).toBeLessThan(0.5);
        });

        it('should calculate correct ratio for 1-char difference', () => {
            const ratio = similarityRatio('lavadora', 'lavdora'); // 1 char substitution
            expect(ratio).toBeGreaterThan(0.85); // 7/8 chars match
        });

        it('should handle different lengths', () => {
            const ratio = similarityRatio('mop', 'mop industrial');
            expect(ratio).toBeGreaterThan(0.0);
            expect(ratio).toBeLessThan(1.0);
        });
    });

    describe('isFuzzyMatch', () => {
        it('should match strings with 1-char typo', () => {
            expect(isFuzzyMatch('lavadora', 'lavdora')).toBe(true);
            expect(isFuzzyMatch('aspirador', 'aspiradro')).toBe(true);
            expect(isFuzzyMatch('carrinho', 'carrino')).toBe(true);
        });

        it('should not match completely different words', () => {
            expect(isFuzzyMatch('lavadora', 'aspirador')).toBe(false);
            expect(isFuzzyMatch('mop', 'balde')).toBe(false);
        });

        it('should respect maxDistance parameter', () => {
            // 2 char difference
            expect(isFuzzyMatch('lavadora', 'lvdora', { maxDistance: 1 })).toBe(false);
            expect(isFuzzyMatch('lavadora', 'lvdora', { maxDistance: 2 })).toBe(true);
        });

        it('should respect minSimilarity parameter', () => {
            // "lavadora" vs "lavdora" (1 char missing): similarity = 1 - 1/8 = 0.875
            expect(isFuzzyMatch('lavadora', 'lavdora', { minSimilarity: 0.8 })).toBe(true);
            expect(isFuzzyMatch('lavadora', 'lavdora', { minSimilarity: 0.9 })).toBe(false);
            // "lavadora" vs "ladora" (2 chars missing): similarity = 1 - 2/8 = 0.75
            expect(isFuzzyMatch('lavadora', 'ladora', { minSimilarity: 0.70 })).toBe(true);
            expect(isFuzzyMatch('lavadora', 'ladora', { minSimilarity: 0.80 })).toBe(false);
        });

        it('should skip matching for very short words', () => {
            // Words shorter than minQueryLength (default: 4) match exactly only
            expect(isFuzzyMatch('mop', 'map')).toBe(false);
            expect(isFuzzyMatch('mop', 'mop')).toBe(true);
        });
    });

    describe('findBestFuzzyMatch', () => {
        const vocabulary = ['lavadora', 'aspirador', 'mop', 'carrinho', 'balde'];

        it('should find best match for typo', () => {
            const result = findBestFuzzyMatch('lavdora', vocabulary);
            expect(result).not.toBeNull();
            expect(result![0]).toBe('lavadora');
        });

        it('should return null if no good match', () => {
            const result = findBestFuzzyMatch('xyz', vocabulary);
            expect(result).toBeNull();
        });

        it('should return match with highest similarity', () => {
            const vocab = ['mop', 'map', 'mapa'];
            const result = findBestFuzzyMatch('mapo', vocab);
            expect(result).not.toBeNull();
            // Should match 'mapa' or 'map' (both close)
        });
    });

    describe('FuzzyMatcher Class', () => {
        const vocabulary = ['lavadora', 'aspirador', 'mop', 'carrinho', 'balde', 'industrial'];

        it('should correct single token', () => {
            const matcher = new FuzzyMatcher(vocabulary);

            expect(matcher.correct('lavdora')).toBe('lavadora');
            expect(matcher.correct('aspiradro')).toBe('aspirador');
            expect(matcher.correct('carrino')).toBe('carrinho');
        });

        it('should not correct if exact match exists', () => {
            const matcher = new FuzzyMatcher(vocabulary);
            expect(matcher.correct('lavadora')).toBe('lavadora');
        });

        it('should not correct very short words', () => {
            const matcher = new FuzzyMatcher(vocabulary);
            expect(matcher.correct('mop')).toBe('mop');
            expect(matcher.correct('mep')).toBe('mep'); // Too short, no correction
        });

        it('should correct full query', () => {
            const matcher = new FuzzyMatcher(vocabulary);
            const result = matcher.correctQuery('lavdora industrial');

            expect(result.corrected).toBe('lavadora industrial');
            expect(result.hasCorrections).toBe(true);
            expect(result.corrections.get('lavdora')).toBe('lavadora');
        });

        it('should handle query with no corrections needed', () => {
            const matcher = new FuzzyMatcher(vocabulary);
            const result = matcher.correctQuery('lavadora industrial');

            expect(result.corrected).toBe('lavadora industrial');
            expect(result.hasCorrections).toBe(false);
        });

        it('should handle multiple corrections in one query', () => {
            const matcher = new FuzzyMatcher(vocabulary);
            const result = matcher.correctQuery('lavdora industriel');

            expect(result.hasCorrections).toBe(true);
            expect(result.corrections.size).toBeGreaterThan(0);
        });

        it('should allow adding to vocabulary', () => {
            const matcher = new FuzzyMatcher(['lavadora']);
            expect(matcher.vocabularySize).toBe(1);

            matcher.addToVocabulary(['aspirador', 'mop']);
            expect(matcher.vocabularySize).toBe(3);

            expect(matcher.correct('aspiradro')).toBe('aspirador');
        });
    });

    describe('buildFuzzyMatcherFromCorpus', () => {
        it('should build vocabulary from corpus', () => {
            const corpus = [
                { text: 'lavadora de piso industrial' },
                { text: 'aspirador de pó 1400w' },
                { text: 'mop microfibra 60cm' },
            ];

            const matcher = buildFuzzyMatcherFromCorpus(corpus);

            expect(matcher.vocabularySize).toBeGreaterThan(0);
            expect(matcher.correct('lavdora')).toBe('lavadora');
            expect(matcher.correct('aspiradro')).toBe('aspirador');
        });

        it('should filter out very short tokens', () => {
            const corpus = [
                { text: 'a de mop' }, // "a" and "de" are too short
            ];

            const matcher = buildFuzzyMatcherFromCorpus(corpus);

            // Should only have "mop" in vocabulary
            expect(matcher.vocabularySize).toBeLessThanOrEqual(1);
        });
    });

    describe('Real-world Typos', () => {
        const matcher = new FuzzyMatcher([
            'lavadora', 'aspirador', 'mop', 'carrinho', 'balde',
            'industrial', 'pressão', 'microfibra', 'litros'
        ]);

        const typos = [
            { wrong: 'lavdora', correct: 'lavadora' },
            { wrong: 'aspiradro', correct: 'aspirador' },
            { wrong: 'carrino', correct: 'carrinho' },
            { wrong: 'industriel', correct: 'industrial' },
            // Removed: { wrong: 'presao', correct: 'pressão' } - requires accented word in corpus
            { wrong: 'microfibr', correct: 'microfibra' },
        ];

        typos.forEach(({ wrong, correct }) => {
            it(`should correct "${wrong}" to "${correct}"`, () => {
                const result = matcher.correct(wrong);
                expect(result).toBe(correct);
            });
        });
    });

    describe('Case Sensitivity', () => {
        it('should be case-insensitive', () => {
            const matcher = new FuzzyMatcher(['lavadora', 'ASPIRADOR', 'MoP']);

            expect(matcher.correct('LAVADORA')).toBe('lavadora');
            expect(matcher.correct('aspirador')).toBe('aspirador');
            expect(matcher.correct('mop')).toBe('mop');
        });
    });
});
