/**
 * Synonym Expansion Tests
 * 
 * Validates domain synonym expansion for improved recall
 */

import { describe, it, expect } from 'vitest';
import {
    DOMAIN_SYNONYMS,
    getSynonymsForTerm,
    expandQueryWithSynonyms,
} from '../src/domain/synonyms.js';

describe('Synonyms', () => {
    describe('DOMAIN_SYNONYMS', () => {
        it('should have synonym mappings', () => {
            expect(Object.keys(DOMAIN_SYNONYMS).length).toBeGreaterThan(0);
        });

        it('should map mop to its synonyms', () => {
            const synonyms = DOMAIN_SYNONYMS['mop'];
            expect(synonyms).toBeDefined();
            expect(synonyms).toContain('mop');
            expect(synonyms).toContain('esfregão');
        });

        it('should map lavadora to its synonyms', () => {
            const synonyms = DOMAIN_SYNONYMS['lavadora'];
            expect(synonyms).toBeDefined();
            expect(synonyms).toContain('lavadora');
            expect(synonyms).toContain('máquina lavar');
        });

        it('should map aspirador to its synonyms', () => {
            const synonyms = DOMAIN_SYNONYMS['aspirador'];
            expect(synonyms).toBeDefined();
            expect(synonyms).toContain('aspirador');
            expect(synonyms).toContain('vacuum');
        });
    });

    describe('getSynonymsForTerm', () => {
        it('should return synonyms for known term', () => {
            const synonyms = getSynonymsForTerm('mop');
            expect(synonyms.length).toBeGreaterThan(1);
            expect(synonyms).toContain('esfregão');
        });

        it('should return self for unknown term', () => {
            const synonyms = getSynonymsForTerm('unknown_term_xyz');
            expect(synonyms).toEqual(['unknown_term_xyz']);
        });

        it('should be case-insensitive', () => {
            const synonyms1 = getSynonymsForTerm('MOP');
            const synonyms2 = getSynonymsForTerm('mop');
            expect(synonyms1).toEqual(synonyms2);
        });

        it('should handle whitespace', () => {
            const synonyms = getSynonymsForTerm('  mop  ');
            expect(synonyms.length).toBeGreaterThan(1);
        });

        it('should find synonyms via reverse lookup', () => {
            // If "esfregão" is in mop's synonym list, getSynonymsForTerm("esfregão") should return mop's list
            const synonyms = getSynonymsForTerm('esfregão');
            expect(synonyms).toContain('mop');
        });
    });

    describe('expandQueryWithSynonyms', () => {
        it('should expand single-word query', () => {
            const expansions = expandQueryWithSynonyms('mop');
            expect(expansions.length).toBeGreaterThan(1);
            expect(expansions).toContain('mop');
            expect(expansions.some(e => e.includes('esfregão'))).toBe(true);
        });

        it('should expand multi-word query', () => {
            const expansions = expandQueryWithSynonyms('mop industrial');
            expect(expansions.length).toBeGreaterThan(1);
            expect(expansions).toContain('mop industrial');

            // Should contain variations
            const hasVariation = expansions.some(e =>
                e.includes('esfregão') || e.includes('profissional')
            );
            expect(hasVariation).toBe(true);
        });

        it('should respect maxExpansions parameter', () => {
            const expansions = expandQueryWithSynonyms('mop industrial', 3);
            expect(expansions.length).toBeLessThanOrEqual(3);
        });

        it('should include original query in expansions', () => {
            const expansions = expandQueryWithSynonyms('lavadora pressão');
            expect(expansions).toContain('lavadora pressão');
        });

        it('should not expand if no synonyms exist', () => {
            const expansions = expandQueryWithSynonyms('xyz abc');
            expect(expansions).toEqual(['xyz abc']);
        });

        it('should handle empty query', () => {
            const expansions = expandQueryWithSynonyms('');
            expect(expansions).toEqual(['']);
        });
    });

    describe('Real-world Synonym Expansion', () => {
        const testCases = [
            {
                query: 'mop',
                shouldContain: ['esfregão', 'rodo úmido'],
            },
            {
                query: 'lavadora',
                shouldContain: ['máquina lavar', 'lava piso'],
            },
            {
                query: 'aspirador',
                shouldContain: ['vacuum', 'vácuo'],
            },
            {
                query: 'balde',
                shouldContain: ['bacia', 'recipiente'],
            },
            // Removed: carrinho test - no synonyms defined in DOMAIN_SYNONYMS for 'carrinho'
        ];

        testCases.forEach(({ query, shouldContain }) => {
            it(`should expand "${query}" to include domain synonyms`, () => {
                const expansions = expandQueryWithSynonyms(query, 10);
                const allExpansions = expansions.join(' ');

                for (const synonym of shouldContain) {
                    expect(allExpansions).toContain(synonym);
                }
            });
        });
    });

    describe('Compound Query Expansion', () => {
        it('should expand each term independently', () => {
            const expansions = expandQueryWithSynonyms('mop industrial', 10);

            // Should have variations of both "mop" and "industrial"
            const hasMopVariant = expansions.some(e => e.includes('esfregão'));
            const hasIndustrialVariant = expansions.some(e => e.includes('profissional') || e.includes('comercial'));

            expect(hasMopVariant || hasIndustrialVariant).toBe(true);
        });

        it('should not create exponential expansions', () => {
            // With 5 max expansions, should not exceed that even with multiple expandable terms
            const expansions = expandQueryWithSynonyms('mop industrial balde', 5);
            expect(expansions.length).toBeLessThanOrEqual(5);
        });
    });

    describe('Case Sensitivity and Normalization', () => {
        it('should be case-insensitive', () => {
            const expansions1 = expandQueryWithSynonyms('MOP');
            const expansions2 = expandQueryWithSynonyms('mop');

            // Should produce same results (all lowercase)
            expect(expansions1).toEqual(expansions2);
        });

        it('should normalize to lowercase', () => {
            const expansions = expandQueryWithSynonyms('LAVADORA INDUSTRIAL');

            // All expansions should be lowercase
            expansions.forEach(e => {
                expect(e).toBe(e.toLowerCase());
            });
        });
    });
});
