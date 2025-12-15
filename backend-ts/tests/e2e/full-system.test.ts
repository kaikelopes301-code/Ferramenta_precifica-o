/**
 * Full System E2E Tests
 * 
 * Comprehensive end-to-end tests against the REAL production server.
 * Tests all integrated endpoints and validates complete system behavior.
 * 
 * Coverage:
 * - Search engine (BM25 + Fuzzy + Synonyms)
 * - Search history persistence
 * - Favorites management
 * - Kit/budget management
 * - Dataset statistics
 * - Analytics tracking
 * - Health and metrics endpoints
 * 
 * @version 1.0.0
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestServer, stopTestServer, getTestServer } from '../utils/testServer.js';

// ==============================================================================
// SETUP & TEARDOWN
// ==============================================================================

describe('Full System E2E Tests', () => {
    let baseURL: string;

    beforeAll(async () => {
        // Start the real server
        const server = await startTestServer({
            port: 4000,
            host: '127.0.0.1',
            databasePath: ':memory:',
            logLevel: 'error',
        });
        baseURL = server.baseURL;
    }, 30000); // 30s timeout for server startup

    afterAll(async () => {
        // Stop the server and cleanup
        await stopTestServer();
    });

    // ==========================================================================
    // HEALTH & METRICS TESTS
    // ==========================================================================

    describe('System Health & Observability', () => {
        it('GET /api/health - should return healthy status', async () => {
            const response = await fetch(`${baseURL}/api/health`);
            expect(response.ok).toBe(true);

            const data = await response.json();
            expect(data.status).toMatch(/healthy|degraded/);
            expect(data.checks).toBeDefined();
            expect(data.checks.search_engine).toBe('pass');
            expect(data.checks.corpus).toBe('pass');
        });

        it('GET /api/metrics - should return system metrics', async () => {
            const response = await fetch(`${baseURL}/api/metrics`);
            expect(response.ok).toBe(true);

            const data = await response.json();
            expect(data.engine).toBeDefined();
            expect(data.engine.documents).toBeGreaterThan(0);
            expect(data.cache).toBeDefined();
            expect(data.performance).toBeDefined();
        });
    });

    // ==========================================================================
    // SEARCH ENGINE TESTS
    // ==========================================================================

    describe('Search Engine (Integrated)', () => {
        it('POST /api/search - should return relevant results', async () => {
            const response = await fetch(`${baseURL}/api/search`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-ID': 'test-e2e-search-1',
                },
                body: JSON.stringify({
                    query: 'escavadeira hidraulica',
                    top_k: 5,
                    min_score: 0.0,
                }),
            });

            expect(response.ok).toBe(true);

            const data = await response.json();
            expect(data.query_original).toBe('escavadeira hidraulica');
            expect(Array.isArray(data.resultados)).toBe(true);
            expect(data.total).toBeGreaterThanOrEqual(0);
            expect(data.metadata).toBeDefined();
            expect(data.metadata.engine).toBe('ts-integrated-v3');
            expect(data.metadata.latency_ms).toBeGreaterThan(0);

            // Validate result structure
            if (data.resultados.length > 0) {
                const firstResult = data.resultados[0];
                expect(firstResult.grupo).toBeDefined();
                expect(firstResult.descricao).toBeDefined();
                expect(firstResult.score).toBeGreaterThan(0);
                expect(firstResult.score_normalized).toBeGreaterThanOrEqual(0);
                expect(firstResult.score_breakdown).toBeDefined();
            }
        });

        it('POST /api/search - should handle empty query gracefully', async () => {
            const response = await fetch(`${baseURL}/api/search`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-ID': 'test-e2e-search-2',
                },
                body: JSON.stringify({
                    query: '',
                    top_k: 5,
                }),
            });

            // Should return validation error
            expect(response.status).toBe(400);
        });

        it('POST /api/search - should apply fuzzy matching', async () => {
            const response = await fetch(`${baseURL}/api/search`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-ID': 'test-e2e-search-3',
                },
                body: JSON.stringify({
                    query: 'carrnho', // Typo: "carrinho" with typo
                    top_k: 3,
                }),
            });

            expect(response.ok).toBe(true);

            const data = await response.json();
            // Should still find results due to fuzzy matching
            expect(data.resultados.length).toBeGreaterThan(0);
        });
    });

    // ==========================================================================
    // SEARCH HISTORY TESTS
    // ==========================================================================

    describe('Search History Persistence', () => {
        const testUserId = 'test-e2e-history-1';

        it('GET /api/history - should return empty history initially', async () => {
            const response = await fetch(`${baseURL}/api/history`, {
                headers: {
                    'X-User-ID': testUserId,
                },
            });

            expect(response.ok).toBe(true);
            const data = await response.json();
            expect(Array.isArray(data.history)).toBe(true);
        });

        it('POST /api/search - should create history entry automatically', async () => {
            // Perform a search
            await fetch(`${baseURL}/api/search`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-ID': testUserId,
                },
                body: JSON.stringify({
                    query: 'bomba centrifuga',
                    top_k: 3,
                }),
            });

            // Check history
            const historyResponse = await fetch(`${baseURL}/api/history`, {
                headers: {
                    'X-User-ID': testUserId,
                },
            });

            const historyData = await historyResponse.json();
            expect(historyData.history.length).toBeGreaterThan(0);

            const lastSearch = historyData.history[0];
            expect(lastSearch.query).toBe('bomba centrifuga');
            expect(lastSearch.results_count).toBeGreaterThanOrEqual(0);
        });

        it('DELETE /api/history/:id - should delete history entry', async () => {
            // Get history
            const historyResponse = await fetch(`${baseURL}/api/history`, {
                headers: {
                    'X-User-ID': testUserId,
                },
            });
            const historyData = await historyResponse.json();
            const entryId = historyData.history[0]?.id;

            if (entryId) {
                // Delete entry
                const deleteResponse = await fetch(`${baseURL}/api/history/${entryId}`, {
                    method: 'DELETE',
                    headers: {
                        'X-User-ID': testUserId,
                    },
                });

                expect(deleteResponse.ok).toBe(true);

                // Verify deletion
                const verifyResponse = await fetch(`${baseURL}/api/history`, {
                    headers: {
                        'X-User-ID': testUserId,
                    },
                });
                const verifyData = await verifyResponse.json();
                expect(verifyData.history.find((h: any) => h.id === entryId)).toBeUndefined();
            }
        });
    });

    // ==========================================================================
    // FAVORITES TESTS
    // ==========================================================================

    describe('Favorites Management', () => {
        const testUserId = 'test-e2e-favorites-1';
        const testEquipmentId = 'TEST-FAV-001';

        it('GET /api/favorites - should return empty list initially', async () => {
            const response = await fetch(`${baseURL}/api/favorites`, {
                headers: {
                    'X-User-ID': testUserId,
                },
            });

            expect(response.ok).toBe(true);
            const data = await response.json();
            expect(Array.isArray(data.favorites)).toBe(true);
        });

        it('POST /api/favorites - should add favorite', async () => {
            const response = await fetch(`${baseURL}/api/favorites`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-ID': testUserId,
                },
                body: JSON.stringify({
                    item_name: 'Carrinho Funcional Completo',
                    price: 350.00,
                    extra: { equipment_id: testEquipmentId },
                }),
            });

            expect(response.status).toBe(201);
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.id).toBeDefined();
        });

        it('GET /api/favorites - should return added favorite', async () => {
            const response = await fetch(`${baseURL}/api/favorites`, {
                headers: {
                    'X-User-ID': testUserId,
                },
            });

            const data = await response.json();
            expect(data.favorites.length).toBeGreaterThan(0);

            const favorite = data.favorites.find((f: any) => {
                const extra = f.extra || {};
                return extra.equipment_id === testEquipmentId;
            });
            expect(favorite).toBeDefined();
            expect(favorite.item_name).toBe('Carrinho Funcional Completo');
        });

        it('DELETE /api/favorites/:id - should remove favorite', async () => {
            // Get favorites
            const listResponse = await fetch(`${baseURL}/api/favorites`, {
                headers: {
                    'X-User-ID': testUserId,
                },
            });
            const listData = await listResponse.json();
            const favoriteId = listData.favorites[0]?.id;

            if (favoriteId) {
                // Delete
                const deleteResponse = await fetch(`${baseURL}/api/favorites/${favoriteId}`, {
                    method: 'DELETE',
                    headers: {
                        'X-User-ID': testUserId,
                    },
                });

                expect(deleteResponse.ok).toBe(true);

                // Verify
                const verifyResponse = await fetch(`${baseURL}/api/favorites`, {
                    headers: {
                        'X-User-ID': testUserId,
                    },
                });
                const verifyData = await verifyResponse.json();
                expect(verifyData.favorites.find((f: any) => f.id === favoriteId)).toBeUndefined();
            }
        });
    });

    // ==========================================================================
    // KIT/BUDGET TESTS
    // ==========================================================================

    describe('Kit/Budget Management', () => {
        const testUserId = 'test-e2e-kit-1';
        let createdItemId: number | undefined;

        it('GET /api/kit - should return empty kit initially', async () => {
            const response = await fetch(`${baseURL}/api/kit`, {
                headers: {
                    'X-User-ID': testUserId,
                },
            });

            expect(response.ok).toBe(true);
            const data = await response.json();
            expect(Array.isArray(data.items)).toBe(true);
        });

        it('POST /api/kit - should add item to kit', async () => {
            const response = await fetch(`${baseURL}/api/kit`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-ID': testUserId,
                },
                body: JSON.stringify({
                    item_name: 'Escavadeira Hidráulica 20t',
                    price: 450000.00,
                    qty: 2,
                }),
            });

            expect(response.status).toBe(201);
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.id).toBeDefined();
            createdItemId = data.id;
        });

        it('GET /api/kit - should return added item with calculated subtotal', async () => {
            const response = await fetch(`${baseURL}/api/kit`, {
                headers: {
                    'X-User-ID': testUserId,
                },
            });

            const data = await response.json();
            expect(data.items.length).toBeGreaterThan(0);

            const item = data.items[0];
            expect(item.item_name).toBe('Escavadeira Hidráulica 20t');
            expect(item.price).toBe(450000.00);
            expect(item.qty).toBe(2);
            expect(item.subtotal).toBe(900000.00); // 450000 * 2
        });

        it('DELETE /api/kit/:id - should remove item from kit', async () => {
            if (createdItemId) {
                const deleteResponse = await fetch(`${baseURL}/api/kit/${createdItemId}`, {
                    method: 'DELETE',
                    headers: {
                        'X-User-ID': testUserId,
                    },
                });

                expect(deleteResponse.ok).toBe(true);

                // Verify
                const verifyResponse = await fetch(`${baseURL}/api/kit`, {
                    headers: {
                        'X-User-ID': testUserId,
                    },
                });
                const verifyData = await verifyResponse.json();
                expect(verifyData.items.find((i: any) => i.id === createdItemId)).toBeUndefined();
            }
        });
    });

    // ==========================================================================
    // DATASET/DATA TESTS
    // ==========================================================================

    describe('Dataset Statistics', () => {
        it('GET /api/data/status - should return dataset info', async () => {
            const response = await fetch(`${baseURL}/api/data/status`);

            expect(response.ok).toBe(true);
            const data = await response.json();

            expect(data.dataset).toBeDefined();
            expect(data.dataset.total_products).toBeGreaterThan(0);
            expect(data.dataset.status).toMatch(/loaded|empty/);

            expect(data.statistics).toBeDefined();
            expect(data.statistics.avg_price).toBeGreaterThanOrEqual(0);
            expect(data.statistics.min_price).toBeGreaterThanOrEqual(0);
            expect(data.statistics.max_price).toBeGreaterThanOrEqual(0);
        });
    });

    // ==========================================================================
    // CORS & HEADERS TESTS
    // ==========================================================================

    describe('CORS & Security Headers', () => {
        it('OPTIONS /api/search - should handle preflight requests', async () => {
            const response = await fetch(`${baseURL}/api/search`, {
                method: 'OPTIONS',
                headers: {
                    'Origin': 'http://localhost:3000',
                    'Access-Control-Request-Method': 'POST',
                },
            });

            expect(response.ok).toBe(true);
            expect(response.headers.get('access-control-allow-origin')).toBeDefined();
            expect(response.headers.get('access-control-allow-methods')).toContain('POST');
        });

        it('POST /api/search - should include request ID in response', async () => {
            const response = await fetch(`${baseURL}/api/search`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    query: 'test',
                    top_k: 1,
                }),
            });

            const data = await response.json();
            expect(data.metadata.request_id).toBeDefined();
        });
    });

    // ==========================================================================
    // ERROR HANDLING TESTS
    // ==========================================================================

    describe('Error Handling', () => {
        it('POST /api/search - should validate required fields', async () => {
            const response = await fetch(`${baseURL}/api/search`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    // Missing 'query' field
                    top_k: 5,
                }),
            });

            expect(response.status).toBe(400);
            const data = await response.json();
            expect(data.error).toBeDefined();
        });

        it('GET /api/nonexistent - should return 404', async () => {
            const response = await fetch(`${baseURL}/api/nonexistent`);
            expect(response.status).toBe(404);
        });

        it('DELETE /api/kit/999999 - should handle non-existent item', async () => {
            const response = await fetch(`${baseURL}/api/kit/999999`, {
                method: 'DELETE',
                headers: {
                    'X-User-ID': 'test-e2e-error',
                },
            });

            // Should not crash (either 404 or 200 with success:false)
            expect([200, 404]).toContain(response.status);
        });
    });

    // ==========================================================================
    // INTEGRATION FLOW TESTS
    // ==========================================================================

    describe('Complete User Flow', () => {
        const flowUserId = 'test-e2e-flow-complete';

        it('Full flow: Search → Save to kit → Add favorite → Check history', async () => {
            // Step 1: Search for equipment
            const searchResponse = await fetch(`${baseURL}/api/search`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-ID': flowUserId,
                },
                body: JSON.stringify({
                    query: 'carrinho', // Changed from 'retroescavadeira' to term that exists in dataset
                    top_k: 3,
                }),
            });

            expect(searchResponse.ok).toBe(true);
            const searchData = await searchResponse.json();
            expect(searchData.resultados.length).toBeGreaterThan(0);

            const firstResult = searchData.resultados[0];

            // Step 2: Add to kit
            const kitResponse = await fetch(`${baseURL}/api/kit`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-ID': flowUserId,
                },
                body: JSON.stringify({
                    item_name: firstResult.descricao,
                    price: 250000,
                    qty: 1,
                }),
            });

            expect(kitResponse.status).toBe(201);

            // Step 3: Add to favorites
            const favResponse = await fetch(`${baseURL}/api/favorites`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-ID': flowUserId,
                },
                body: JSON.stringify({
                    item_name: firstResult.descricao,
                    price: null,
                    extra: { equipment_id: firstResult.grupo },
                }),
            });

            expect(favResponse.status).toBe(201);

            // Step 4: Verify history was created
            const historyResponse = await fetch(`${baseURL}/api/history`, {
                headers: {
                    'X-User-ID': flowUserId,
                },
            });

            const historyData = await historyResponse.json();
            expect(historyData.history.length).toBeGreaterThan(0);
            expect(historyData.history.some((h: any) => h.query === 'carrinho')).toBe(true);

            // Step 5: Verify all data persisted
            const kitCheck = await fetch(`${baseURL}/api/kit`, {
                headers: { 'X-User-ID': flowUserId },
            });
            const kitData = await kitCheck.json();
            expect(kitData.items.length).toBeGreaterThan(0);

            const favCheck = await fetch(`${baseURL}/api/favorites`, {
                headers: { 'X-User-ID': flowUserId },
            });
            const favData = await favCheck.json();
            expect(favData.favorites.length).toBeGreaterThan(0);
        });
    });
});
