/**
 * FASE 1 TESTS: Database & Persistence
 * 
 * Comprehensive test suite covering all database operations,
 * repositories, user identification, and edge cases.
 */

import { DataSource } from 'typeorm';
import { SearchHistory, Favorite, KitItem, UserPreference, AppDataSource, initializeDatabase, closeDatabase } from '../../src/infra/database/connection';
import { SearchHistoryRepository } from '../../src/domain/repositories/SearchHistoryRepository';
import { FavoritesRepository } from '../../src/domain/repositories/FavoritesRepository';
import { KitRepository } from '../../src/domain/repositories/KitRepository';
import { UserPreferencesRepository } from '../../src/domain/repositories/UserPreferencesRepository';
import { getUserId } from '../../src/api/middleware/userIdentification';
import { faker } from '@faker-js/faker';

describe('FASE 1: Database & Persistence - Complete Test Suite', () => {

    beforeAll(async () => {
        // Use in-memory database for tests
        process.env.DATABASE_PATH = ':memory:';
        await initializeDatabase();
    });

    afterAll(async () => {
        await closeDatabase();
    });

    // ===========================================================================
    // T1: DATABASE CONNECTION TESTS
    // ===========================================================================

    describe('T1: Database Connection', () => {

        it('T1.1: Should connect to SQLite successfully', () => {
            expect(AppDataSource.isInitialized).toBe(true);
        });

        it('T1.2: Should create all tables with correct schema', async () => {
            const tables = await AppDataSource.query(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
            );
            const tableNames = tables.map((t: any) => t.name);

            expect(tableNames).toContain('search_history');
            expect(tableNames).toContain('favorites');
            expect(tableNames).toContain('kit_items');
            expect(tableNames).toContain('user_preferences');
        });

        it('T1.3: Should enable WAL mode', async () => {
            const result = await AppDataSource.query('PRAGMA journal_mode');
            expect(result[0].journal_mode.toLowerCase()).toBe('wal');
        });

        it('T1.4: Should enable foreign keys', async () => {
            const result = await AppDataSource.query('PRAGMA foreign_keys');
            expect(result[0].foreign_keys).toBe(1);
        });
    });

    // ===========================================================================
    // T2: USER IDENTIFICATION TESTS
    // ===========================================================================

    describe('T2: User Identification', () => {

        it('T2.1: Should extract user_id from X-User-ID header', () => {
            const request = {
                headers: { 'x-user-id': 'test-user-123' },
                cookies: {},
                ip: '127.0.0.1',
            } as any;

            expect(getUserId(request)).toBe('test-user-123');
        });

        it('T2.2: Should extract user_id from cookie', () => {
            const request = {
                headers: {},
                cookies: { user_id: 'cookie-user-456' },
                ip: '127.0.0.1',
            } as any;

            expect(getUserId(request)).toBe('cookie-user-456');
        });

        it('T2.3: Should generate fingerprint from IP + UA', () => {
            const request = {
                headers: { 'user-agent': 'Mozilla/5.0' },
                cookies: {},
                ip: '192.168.1.1',
            } as any;

            const userId = getUserId(request);
            expect(userId).toBeDefined();
            expect(userId.length).toBe(32); // MD5 hash length
        });

        it('T2.4: Should return consistent ID for same fingerprint', () => {
            const request = {
                headers: { 'user-agent': 'Mozilla/5.0' },
                cookies: {},
                ip: '192.168.1.1',
            } as any;

            const id1 = getUserId(request);
            const id2 = getUserId(request);
            expect(id1).toBe(id2);
        });

        it('T2.5: Should handle missing headers gracefully', () => {
            const request = {
                headers: {},
                cookies: {},
                ip: 'unknown',
            } as any;

            const userId = getUserId(request);
            expect(userId).toBeDefined();
            expect(typeof userId).toBe('string');
        });
    });

    // ===========================================================================
    // T3: SEARCH HISTORY REPOSITORY TESTS
    // ===========================================================================

    describe('T3: SearchHistoryRepository', () => {
        let repo: SearchHistoryRepository;
        const testUserId = 'test-user-history';

        beforeEach(() => {
            repo = new SearchHistoryRepository();
        });

        afterEach(async () => {
            await AppDataSource.getRepository(SearchHistory).clear();
        });

        it('T3.1: Should create search history entry', async () => {
            const entry = await repo.create({
                user_id: testUserId,
                query: 'mop industrial',
                results_count: 5,
            });

            expect(entry.id).toBeDefined();
            expect(entry.user_id).toBe(testUserId);
            expect(entry.query).toBe('mop industrial');
            expect(entry.results_count).toBe(5);
        });

        it('T3.2: Should find entry by ID', async () => {
            const created = await repo.create({
                user_id: testUserId,
                query: 'lavadora piso',
                results_count: 3,
            });

            const found = await repo.findById(created.id);
            expect(found).not.toBeNull();
            expect(found?.query).toBe('lavadora piso');
        });

        it('T3.3: Should list user history ordered by date DESC', async () => {
            // Create 3 entries with significant delays to ensure distinct timestamps in SQLite
            await repo.create({ user_id: testUserId, query: 'query1', results_count: 1 });
            await new Promise(resolve => setTimeout(resolve, 1001)); // 1+ second to ensure distinct timestamp
            await repo.create({ user_id: testUserId, query: 'query2', results_count: 2 });
            await new Promise(resolve => setTimeout(resolve, 1001)); // 1+ second to ensure distinct timestamp
            await repo.create({ user_id: testUserId, query: 'query3', results_count: 3 });

            const history = await repo.findAll({ user_id: testUserId });

            expect(history.length).toBe(3);
            expect(history[0].query).toBe('query3'); // Most recent first
            expect(history[2].query).toBe('query1');
        });

        it('T3.4: Should respect limit parameter', async () => {
            // Create 5 entries
            for (let i = 0; i < 5; i++) {
                await repo.create({ user_id: testUserId, query: `query${i}`, results_count: i });
            }

            const limited = await repo.findAll({ user_id: testUserId, limit: 3 });
            expect(limited.length).toBe(3);
        });

        it('T3.5: Should isolate users (user A != user B)', async () => {
            await repo.create({ user_id: 'user-a', query: 'query-a', results_count: 1 });
            await repo.create({ user_id: 'user-b', query: 'query-b', results_count: 2 });

            const historyA = await repo.findAll({ user_id: 'user-a' });
            const historyB = await repo.findAll({ user_id: 'user-b' });

            expect(historyA.length).toBe(1);
            expect(historyB.length).toBe(1);
            expect(historyA[0].query).toBe('query-a');
            expect(historyB[0].query).toBe('query-b');
        });

        it('T3.6: Should handle empty history', async () => {
            const empty = await repo.findAll({ user_id: 'nonexistent-user' });
            expect(empty.length).toBe(0);
        });

        it('T3.7: Should log search with helper method', async () => {
            await repo.logSearch(testUserId, 'test search', 10);

            const history = await repo.findAll({ user_id: testUserId });
            expect(history.length).toBe(1);
            expect(history[0].query).toBe('test search');
            expect(history[0].results_count).toBe(10);
        });

        it('T3.8: Should update results_count', async () => {
            const entry = await repo.create({
                user_id: testUserId,
                query: 'test',
                results_count: 5,
            });

            await repo.update(entry.id, { results_count: 10 });

            const updated = await repo.findById(entry.id);
            expect(updated?.results_count).toBe(10);
        });

        it('T3.9: Should delete entry', async () => {
            const entry = await repo.create({
                user_id: testUserId,
                query: 'to delete',
                results_count: 1,
            });

            const deleted = await repo.delete(entry.id);
            expect(deleted).toBe(true);

            const notFound = await repo.findById(entry.id);
            expect(notFound).toBeNull();
        });
    });

    // ===========================================================================
    // T4: FAVORITES REPOSITORY TESTS
    // =========================================================================== 

    describe('T4: FavoritesRepository', () => {
        let repo: FavoritesRepository;
        const testUserId = 'test-user-fav';

        beforeEach(() => {
            repo = new FavoritesRepository();
        });

        afterEach(async () => {
            await AppDataSource.getRepository(Favorite).clear();
        });

        it('T4.1: Should add favorite successfully', async () => {
            const fav = await repo.create({
                user_id: testUserId,
                item_name: 'Mop Industrial 60cm',
                price: 45.0,
            });

            expect(fav.id).toBeDefined();
            expect(fav.item_name).toBe('Mop Industrial 60cm');
            expect(fav.price).toBe(45.0);
        });

        it('T4.2: Should list user favorites only', async () => {
            await repo.create({ user_id: 'user-1', item_name: 'Item A', price: 10 });
            await repo.create({ user_id: 'user-2', item_name: 'Item B', price: 20 });
            await repo.create({ user_id: 'user-1', item_name: 'Item C', price: 30 });

            const favs = await repo.findAll({ user_id: 'user-1' });
            expect(favs.length).toBe(2);
            expect(favs.map(f => f.item_name)).toContain('Item A');
            expect(favs.map(f => f.item_name)).toContain('Item C');
        });

        it('T4.3: Should parse extra JSON correctly', async () => {
            const extra = JSON.stringify({ link: 'http://example.com', notes: 'Test note' });

            const fav = await repo.create({
                user_id: testUserId,
                item_name: 'Test Item',
                price: 100,
                extra,
            });

            expect(fav.extra).toBe(extra);
            const parsed = JSON.parse(fav.extra!);
            expect(parsed.link).toBe('http://example.com');
            expect(parsed.notes).toBe('Test note');
        });

        it('T4.4: Should delete favorite by ID', async () => {
            const fav = await repo.create({
                user_id: testUserId,
                item_name: 'To Delete',
                price: 50,
            });

            const deleted = await repo.delete(fav.id);
            expect(deleted).toBe(true);

            const notFound = await repo.findById(fav.id);
            expect(notFound).toBeNull();
        });

        it('T4.5: Should prevent deleting other users favorites', async () => {
            const fav = await repo.create({
                user_id: 'user-a',
                item_name: 'User A Item',
                price: 100,
            });

            // Try to delete as user-b
            const deleted = await repo.deleteByIdAndUser(fav.id, 'user-b');
            expect(deleted).toBe(false);

            // Should still exist
            const stillExists = await repo.findById(fav.id);
            expect(stillExists).not.toBeNull();
        });

        it('T4.6: Should handle missing price (null)', async () => {
            const fav = await repo.create({
                user_id: testUserId,
                item_name: 'No Price Item',
                price: null,
            });

            expect(fav.price).toBeNull();
        });

        it('T4.7: Should validate required fields (item_name)', async () => {
            await expect(async () => {
                await repo.create({
                    user_id: testUserId,
                    item_name: '', // Empty name
                    price: 10,
                });
            }).rejects.toThrow();
        });
    });

    // ===========================================================================
    // T5: KIT REPOSITORY TESTS
    // ===========================================================================

    describe('T5: KitRepository', () => {
        let repo: KitRepository;
        const testUserId = 'test-user-kit';

        beforeEach(() => {
            repo = new KitRepository();
        });

        afterEach(async () => {
            await AppDataSource.getRepository(KitItem).clear();
        });

        it('T5.1: Should add item to kit with quantity', async () => {
            const item = await repo.create({
                user_id: testUserId,
                item_name: 'Mop',
                price: 45,
                qty: 5,
            });

            expect(item.qty).toBe(5);
            expect(item.item_name).toBe('Mop');
        });

        it('T5.2: Should calculate budget correctly', async () => {
            await repo.create({ user_id: testUserId, item_name: 'Mop', price: 45, qty: 5 });
            await repo.create({ user_id: testUserId, item_name: 'Lavadora', price: 1200, qty: 2 });
            await repo.create({ user_id: testUserId, item_name: 'Escada', price: 180, qty: 3 });

            const budget = await repo.calculateBudget(testUserId);

            // 45*5 + 1200*2 + 180*3 = 225 + 2400 + 540 = 3165
            expect(budget.total).toBe(3165.00);
            expect(budget.items.length).toBe(3);
        });

        it('T5.3: Should calculate subtotal (price * qty)', async () => {
            await repo.create({ user_id: testUserId, item_name: 'Item A', price: 10.50, qty: 3 });

            const budget = await repo.calculateBudget(testUserId);

            expect(budget.items[0].subtotal).toBe(31.50);
        });

        it('T5.4: Should delete kit item', async () => {
            const item = await repo.create({
                user_id: testUserId,
                item_name: 'To Delete',
                price: 10,
                qty: 1,
            });

            await repo.delete(item.id);

            const notFound = await repo.findById(item.id);
            expect(notFound).toBeNull();
        });

        it('T5.5: Should handle zero price gracefully', async () => {
            await repo.create({ user_id: testUserId, item_name: 'Free Item', price: 0, qty: 10 });

            const budget = await repo.calculateBudget(testUserId);
            expect(budget.total).toBe(0);
        });

        it('T5.6: Should handle null price as zero', async () => {
            await repo.create({ user_id: testUserId, item_name: 'Null Price', price: null, qty: 5 });

            const budget = await repo.calculateBudget(testUserId);
            expect(budget.total).toBe(0);
        });

        it('T5.7: Should isolate users', async () => {
            await repo.create({ user_id: 'user-1', item_name: 'Item 1', price: 10, qty: 1 });
            await repo.create({ user_id: 'user-2', item_name: 'Item 2', price: 20, qty: 1 });

            const budget1 = await repo.calculateBudget('user-1');
            const budget2 = await repo.calculateBudget('user-2');

            expect(budget1.total).toBe(10);
            expect(budget2.total).toBe(20);
        });

        it('T5.8: Should round to 2 decimals', async () => {
            await repo.create({ user_id: testUserId, item_name: 'Item', price: 10.333, qty: 3 });

            const budget = await repo.calculateBudget(testUserId);
            expect(budget.total).toBe(31.00); // 10.33 * 3 rounded
        });
    });

    // ===========================================================================
    // T6: USER PREFERENCES REPOSITORY TESTS  
    // ===========================================================================

    describe('T6: UserPreferencesRepository', () => {
        let repo: UserPreferencesRepository;

        beforeEach(() => {
            repo = new UserPreferencesRepository();
        });

        afterEach(async () => {
            await AppDataSource.getRepository(UserPreference).clear();
        });

        it('T6.1: Should create new preference', async () => {
            const pref = await repo.upsert('user-1', { theme: 'dark', lang: 'pt' });

            expect(pref.user_id).toBe('user-1');
            const data = JSON.parse(pref.data);
            expect(data.theme).toBe('dark');
            expect(data.lang).toBe('pt');
        });

        it('T6.2: Should update existing preference (upsert)', async () => {
            await repo.upsert('user-1', { theme: 'light' });
            await repo.upsert('user-1', { theme: 'dark', newField: 'value' });

            const pref = await repo.findByUserId('user-1');
            const data = JSON.parse(pref!.data);

            expect(data.theme).toBe('dark');
            expect(data.newField).toBe('value');
        });

        it('T6.3: Should get parsed preferences', async () => {
            await repo.upsert('user-1', { context_tags: ['hospital', 'clinic'] });

            const prefs = await repo.getPreferences('user-1');
            expect(prefs.context_tags).toEqual(['hospital', 'clinic']);
        });

        it('T6.4: Should update context tags', async () => {
            const tags = await repo.updateContextTags('user-1', ['tag1', 'tag2', 'tag3']);

            expect(tags).toEqual(['tag1', 'tag2', 'tag3']);

            const prefs = await repo.getPreferences('user-1');
            expect(prefs.context_tags).toEqual(['tag1', 'tag2', 'tag3']);
        });

        it('T6.5: Should handle empty preferences', async () => {
            const prefs = await repo.getPreferences('nonexistent');
            expect(prefs).toEqual({});
        });

        it('T6.6: Should delete preferences', async () => {
            await repo.upsert('user-1', { test: 'data' });
            const deleted = await repo.delete('user-1');

            expect(deleted).toBe(true);

            const notFound = await repo.findByUserId('user-1');
            expect(notFound).toBeNull();
        });
    });

    // ===========================================================================
    // T7: EDGE CASES & STRESS TESTS
    // ===========================================================================

    describe('T7: Edge Cases & Stress Tests', () => {

        it('T7.1: Should handle concurrent writes', async () => {
            const repo = new SearchHistoryRepository();
            const user_id = 'concurrent-user';

            // Create 10 entries concurrently
            const promises = Array.from({ length: 10 }, (_, i) =>
                repo.create({ user_id, query: `query-${i}`, results_count: i })
            );

            await Promise.all(promises);

            const history = await repo.findAll({ user_id });
            expect(history.length).toBe(10);
        });

        it('T7.2: Should handle very long strings', async () => {
            const repo = new FavoritesRepository();
            const longName = 'A'.repeat(1000);

            const fav = await repo.create({
                user_id: 'test',
                item_name: longName,
                price: 10,
            });

            expect(fav.item_name.length).toBe(1000);
        });

        it('T7.3: Should handle special characters', async () => {
            const repo = new SearchHistoryRepository();
            const specialQuery = 'Test "quotes" & <tags> \'single\' $symbols';

            const entry = await repo.create({
                user_id: 'test',
                query: specialQuery,
                results_count: 1,
            });

            expect(entry.query).toBe(specialQuery);
        });

        it('T7.4: Should handle large JSON in extra field', async () => {
            const repo = new FavoritesRepository();
            const largeExtra = {
                data: Array.from({ length: 100 }, (_, i) => ({ key: `value-${i}` })),
            };

            const fav = await repo.create({
                user_id: 'test',
                item_name: 'Large Extra',
                price: 10,
                extra: JSON.stringify(largeExtra),
            });

            const parsed = JSON.parse(fav.extra!);
            expect(parsed.data.length).toBe(100);
        });

        it('T7.5: Should handle invalid JSON gracefully in preferences', async () => {
            const repo = new UserPreferencesRepository();

            // Manually insert invalid JSON
            await AppDataSource.getRepository(UserPreference).save({
                user_id: 'bad-json-user',
                data: 'invalid{json}',
            });

            const prefs = await repo.getPreferences('bad-json-user');
            expect(prefs).toEqual({}); // Should return empty object
        });
    });
});
