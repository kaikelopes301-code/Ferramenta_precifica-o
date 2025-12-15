/**
 * Reranker Module Tests
 * 
 * Validates intent-based reranking to fix accessory vs equipment ranking issues.
 * Golden queries to ensure "enceradeira 510" ranks higher than "discos".
 */

import { describe, it, expect } from 'vitest';
import { parseQuery, classifyDoc, rerank, type QueryIntent, type DocType } from '../src/domain/reranker';

describe('Reranker Module', () => {
    // ==================================
    // parseQuery() Tests
    // ==================================
    
    describe('parseQuery', () => {
        it('should detect EQUIPAMENTO intent for equipment queries', () => {
            const result = parseQuery('enceradeira 510');
            
            expect(result.intent).toBe('EQUIPAMENTO');
            expect(result.mainCategory).toBe('enceradeira');
            expect(result.modelNumbers).toContain('510');
            expect(result.accessoryTerms).toHaveLength(0);
        });
        
        it('should detect EQUIPAMENTO intent even with accessory context', () => {
            const result = parseQuery('enceradeira de piso 510 c/ discos e escovas');
            
            expect(result.intent).toBe('EQUIPAMENTO');
            expect(result.mainCategory).toBe('enceradeira');
            expect(result.modelNumbers).toContain('510');
            expect(result.accessoryTerms).toContain('disco');
            expect(result.accessoryTerms).toContain('escova');
        });
        
        it('should detect ACESSORIO intent for accessory-only queries', () => {
            const result = parseQuery('disco verde 510 mm');
            
            expect(result.intent).toBe('ACESSORIO');
            expect(result.mainCategory).toBeUndefined();
            expect(result.modelNumbers).toContain('510');
            expect(result.accessoryTerms).toContain('disco');
        });

        it('should detect ACESSORIO intent when accessory appears before category', () => {
            const result = parseQuery('disco para enceradeira 510');

            expect(result.intent).toBe('ACESSORIO');
            expect(result.mainCategory).toBe('enceradeira');
            expect(result.modelNumbers).toContain('510');
            expect(result.accessoryTerms).toContain('disco');
        });
        
        it('should detect INDEFINIDO intent for ambiguous queries', () => {
            const result = parseQuery('510 mm azul');
            
            expect(result.intent).toBe('INDEFINIDO');
            expect(result.mainCategory).toBeUndefined();
            expect(result.modelNumbers).toContain('510');
        });
        
        it('should extract multiple model numbers', () => {
            const result = parseQuery('enceradeira 350 ou 510 mm');
            
            expect(result.modelNumbers).toContain('350');
            expect(result.modelNumbers).toContain('510');
        });
        
        it('should handle queries with various equipment categories', () => {
            const categories = [
                { query: 'lavadora de piso 120l', expected: 'lavadora' },
                { query: 'aspirador 1400w', expected: 'aspirador' },
                { query: 'vassoura mop', expected: 'vassoura' },
                { query: 'carrinho funcional', expected: 'carrinho' },
            ];
            
            for (const { query, expected } of categories) {
                const result = parseQuery(query);
                expect(result.intent).toBe('EQUIPAMENTO');
                expect(result.mainCategory).toBe(expected);
            }
        });
    });
    
    // ==================================
    // classifyDoc() Tests
    // ==================================
    
    describe('classifyDoc', () => {
        it('should classify equipment documents correctly', () => {
            const result = classifyDoc('enceradeira 510 mm');
            
            expect(result.docType).toBe('EQUIPAMENTO');
            expect(result.category).toBe('enceradeira');
            expect(result.hasCategoryTerms).toBe(true);
            expect(result.hasAccessoryTerms).toBe(false);
        });
        
        it('should classify accessory documents correctly', () => {
            const result = classifyDoc('disco verde 510 mm');
            
            expect(result.docType).toBe('ACESSORIO');
            expect(result.hasAccessoryTerms).toBe(true);
            expect(result.hasCategoryTerms).toBe(false);
        });
        
        it('should classify "para" constructions as accessories', () => {
            const result = classifyDoc('disco de escovas para enceradeira');
            
            expect(result.docType).toBe('ACESSORIO');
            expect(result.hasAccessoryTerms).toBe(true);
            expect(result.hasCategoryTerms).toBe(true);
        });
        
        it('should detect model number matches', () => {
            const result = classifyDoc('enceradeira 510 mm', ['510', '350']);
            
            expect(result.hasModelNumberMatch).toBe(true);
        });
        
        it('should not match different model numbers', () => {
            const result = classifyDoc('enceradeira 350 mm', ['510']);
            
            expect(result.hasModelNumberMatch).toBe(false);
        });
    });
    
    // ==================================
    // rerank() Tests - Golden Queries
    // ==================================
    
    describe('rerank - Golden Query Cases', () => {
        it('GOLDEN 1: "enceradeira 510" should rank equipment above accessories', () => {
            const query = 'enceradeira 510';
            const parsedQuery = parseQuery(query);
            
            const results = [
                { id: 'equip', score: 15.5, text: 'enceradeira 510 mm' },
                { id: 'disc_verde', score: 14.2, text: 'disco verde 510 mm' },
                { id: 'disc_escova', score: 13.8, text: 'disco de escovas para enceradeira 510' },
            ];
            
            const reranked = rerank(results, parsedQuery, 15.5);
            
            // Equipment should be TOP 1
            expect(reranked[0].id).toBe('equip');
            expect(reranked[0].classification.docType).toBe('EQUIPAMENTO');
            
            // Accessories should be penalized
            expect(reranked[1].accessoryPenalty).toBeGreaterThan(0);
            expect(reranked[2].accessoryPenalty).toBeGreaterThan(0);
            
            // Equipment score should be much higher after rerank
            expect(reranked[0].finalScore).toBeGreaterThan(reranked[1].finalScore + 0.2);
        });
        
        it('GOLDEN 2: "enceradeira 510 c/ discos e escovas" should rank equipment first', () => {
            const query = 'enceradeira de piso 510 c/ discos e escovas';
            const parsedQuery = parseQuery(query);
            
            // Simulate BM25 giving higher score to "disco" due to term overlap
            const results = [
                { id: 'disc_escova', score: 18.2, text: 'disco de escovas para enceradeira' },
                { id: 'equip', score: 17.5, text: 'enceradeira de piso 510' },
                { id: 'disc_verde', score: 14.0, text: 'disco verde 510 mm' },
            ];
            
            const reranked = rerank(results, parsedQuery, 18.2);
            
            // After rerank, equipment should be TOP 1 even if BM25 ranked it #2
            expect(reranked[0].id).toBe('equip');
            expect(reranked[0].classification.docType).toBe('EQUIPAMENTO');
            
            // Verify accessories were heavily penalized
            const accessoryResult = reranked.find(r => r.id === 'disc_escova');
            expect(accessoryResult?.accessoryPenalty).toBe(1);
        });
        
        it('GOLDEN 3: "disco para enceradeira 510" should NOT penalize accessories (intent: ACESSORIO)', () => {
            const query = 'disco para enceradeira 510';
            const parsedQuery = parseQuery(query);
            
            const results = [
                { id: 'disc_verde', score: 16.0, text: 'disco verde 510 mm' },
                { id: 'disc_escova', score: 15.5, text: 'disco de escovas para enceradeira' },
                { id: 'equip', score: 14.0, text: 'enceradeira 510 mm' },
            ];
            
            const reranked = rerank(results, parsedQuery, 16.0);
            
            expect(parsedQuery.intent).toBe('ACESSORIO');

            // With the exact scoring formula, we only guarantee that accessories are not penalized.
            // (Order can still vary depending on BM25 + boosts.)
            for (const r of reranked) {
                expect(r.accessoryPenalty).toBe(0);
            }
        });
        
        it('should apply model number boost correctly', () => {
            const query = 'lavadora 120l';
            const parsedQuery = parseQuery(query);
            
            const results = [
                { id: 'lavadora120', score: 15.0, text: 'lavadora brava 120l' },
                { id: 'lavadora100', score: 14.5, text: 'lavadora brava 100l' },
            ];
            
            const reranked = rerank(results, parsedQuery, 15.0);
            
            // Lavadora 120L should have model boost
            expect(reranked[0].modelBoost).toBe(1);
            expect(reranked[1].modelBoost).toBe(0);
            expect(reranked[0].finalScore).toBeGreaterThan(reranked[1].finalScore);
        });
        
        it('should apply category match boost', () => {
            const query = 'enceradeira industrial';
            const parsedQuery = parseQuery(query);
            
            const results = [
                { id: 'enceradeira', score: 12.0, text: 'enceradeira de piso 510' },
                { id: 'lavadora', score: 11.8, text: 'lavadora de piso a3' },
            ];
            
            const reranked = rerank(results, parsedQuery, 12.0);
            
            // Enceradeira should have category boost
            expect(reranked[0].categoryBoost).toBe(1);
            expect(reranked[1].categoryBoost).toBe(0);
            expect(reranked[0].id).toBe('enceradeira');
        });
    });
    
    // ==================================
    // Edge Cases
    // ==================================
    
    describe('rerank - Edge Cases', () => {
        it('should handle empty results', () => {
            const query = 'enceradeira 510';
            const parsedQuery = parseQuery(query);
            
            const reranked = rerank([], parsedQuery, 0);
            
            expect(reranked).toHaveLength(0);
        });
        
        it('should handle single result', () => {
            const query = 'enceradeira 510';
            const parsedQuery = parseQuery(query);
            
            const results = [
                { id: 'equip', score: 15.0, text: 'enceradeira 510 mm' },
            ];
            
            const reranked = rerank(results, parsedQuery, 15.0);
            
            expect(reranked).toHaveLength(1);
            expect(reranked[0].id).toBe('equip');
        });
        
        it('should handle zero maxScore', () => {
            const query = 'enceradeira 510';
            const parsedQuery = parseQuery(query);
            
            const results = [
                { id: 'equip', score: 0, text: 'enceradeira 510 mm' },
            ];
            
            const reranked = rerank(results, parsedQuery, 0);
            
            expect(reranked[0].bm25Norm).toBe(0);
            // Should still apply boosts even with 0 BM25
            expect(reranked[0].finalScore).toBeGreaterThanOrEqual(0);
        });
        
        it('should not produce negative scores', () => {
            const query = 'enceradeira 510';
            const parsedQuery = parseQuery(query);
            
            const results = [
                { id: 'accessory', score: 5.0, text: 'disco verde 510 mm' },
            ];
            
            const reranked = rerank(results, parsedQuery, 10.0);
            
            // Heavy penalty, but score should not go negative
            expect(reranked[0].finalScore).toBeGreaterThanOrEqual(0);
        });
    });
});
