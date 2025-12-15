/**
 * FASE 1 - Manual Test Script
 * 
 * Testa todas as funcionalidades de persistência com dados reais.
 * Executar: tsx tests/phase1/manual-test.ts
 */

import 'reflect-metadata';
import { initializeDatabase, closeDatabase } from '../../src/infra/database/connection.js';
import { SearchHistoryRepository } from '../../src/domain/repositories/SearchHistoryRepository.js';
import { FavoritesRepository } from '../../src/domain/repositories/FavoritesRepository.js';
import { KitRepository } from '../../src/domain/repositories/KitRepository.js';
import { UserPreferencesRepository } from '../../src/domain/repositories/UserPreferencesRepository.js';
import { getUserId } from '../../src/api/middleware/userIdentification.js';

// Test data - Real products from the cleaning products dataset
const testProducts = [
    { name: 'Mop Industrial 60cm', price: 45.0, life: 24, maint: 5.0 },
    { name: 'Lavadora de Piso Profissional', price: 1200.0, life: 60, maint: 8.0 },
    { name: 'Escada Alumínio 3 Degraus', price: 180.0, life: 36, maint: 3.0 },
    { name: 'Carrinho Plataforma 200kg', price: 350.0, life: 48, maint: 4.0 },
    { name: 'Rodo Plástico 40cm', price: 25.0, life: 12, maint: 10.0 },
];

let testsPassed = 0;
let testsFailed = 0;

function assert(condition: boolean, message: string) {
    if (condition) {
        console.log(`  ✅ ${message}`);
        testsPassed++;
    } else {
        console.log(`  ❌ ${message}`);
        testsFailed++;
    }
}

async function runTests() {
    console.log('\n🧪 FASE 1 - Testes de Persistência\n');
    console.log('='.repeat(60));

    try {
        // Initialize database
        console.log('\n📦 Inicializando database...');
        await initializeDatabase();
        console.log('✅ Database inicializado\n');

        // ===========================================================================
        // T1: USER IDENTIFICATION
        // ===========================================================================
        console.log('T1: User Identification');
        console.log('-'.repeat(60));

        const req1 = { headers: { 'x-user-id': 'test-user' }, cookies: {}, ip: '127.0.0.1' } as any;
        assert(getUserId(req1) === 'test-user', 'Should extract from X-User-ID header');

        const req2 = { headers: {}, cookies: { user_id: 'cookie-user' }, ip: '127.0.0.1' } as any;
        assert(getUserId(req2) === 'cookie-user', 'Should extract from cookie');

        const req3 = { headers: { 'user-agent': 'Test-Agent' }, cookies: {}, ip: '192.168.1.1' } as any;
        const fingerprintId = getUserId(req3);
        assert(fingerprintId.length === 32, 'Should generate MD5 fingerprint');
        assert(getUserId(req3) === fingerprintId, 'Should be consistent');

        // ===========================================================================
        // T2: SEARCH HISTORY REPOSITORY
        // ===========================================================================
        console.log('\nT2: Search History Repository');
        console.log('-'.repeat(60));

        const historyRepo = new SearchHistoryRepository();

        // Create entries
        await historyRepo.logSearch('user-1', testProducts[0].name, 5);
        await historyRepo.logSearch('user-1', testProducts[1].name, 3);
        await historyRepo.logSearch('user-2', testProducts[2].name, 8);

        const history1 = await historyRepo.findAll({ user_id: 'user-1' });
        assert(history1.length === 2, 'Should have 2 entries for user-1');

        const history2 = await historyRepo.findAll({ user_id: 'user-2' });
        assert(history2.length === 1, 'Should isolate users');

        const limited = await historyRepo.findAll({ user_id: 'user-1', limit: 1 });
        assert(limited.length === 1, 'Should respect limit');

        // ===========================================================================
        // T3: FAVORITES REPOSITORY
        // ===========================================================================
        console.log('\nT3: Favorites Repository');
        console.log('-'.repeat(60));

        const favRepo = new FavoritesRepository();

        // Add favorites
        const fav1 = await favRepo.create({
            user_id: 'user-a',
            item_name: testProducts[0].name,
            price: testProducts[0].price,
            extra: JSON.stringify({ life: testProducts[0].life }),
        });
        assert(fav1.id > 0, 'Should create favorite with ID');

        await favRepo.create({
            user_id: 'user-a',
            item_name: testProducts[1].name,
            price: testProducts[1].price,
        });

        const favsA = await favRepo.findAll({ user_id: 'user-a' });
        assert(favsA.length === 2, 'Should list user favorites');

        // Test deletion with user isolation
        const deleted = await favRepo.deleteByIdAndUser(fav1.id, 'user-b');
        assert(deleted === false, 'Should not delete other users favorites');

        const deletedOwn = await favRepo.deleteByIdAndUser(fav1.id, 'user-a');
        assert(deletedOwn === true, 'Should delete own favorite');

        const favsAfter = await favRepo.findAll({ user_id: 'user-a' });
        assert(favsAfter.length === 1, 'Should have 1 favorite after deletion');

        // ===========================================================================
        // T4: KIT REPOSITORY
        // ===========================================================================
        console.log('\nT4: Kit Repository');
        console.log('-'.repeat(60));

        const kitRepo = new KitRepository();

        // Build a kit with real products
        await kitRepo.create({
            user_id: 'kit-user',
            item_name: testProducts[0].name,
            price: testProducts[0].price,
            qty: 5,
        });

        await kitRepo.create({
            user_id: 'kit-user',
            item_name: testProducts[1].name,
            price: testProducts[1].price,
            qty: 2,
        });

        await kitRepo.create({
            user_id: 'kit-user',
            item_name: testProducts[2].name,
            price: testProducts[2].price,
            qty: 3,
        });

        const kitItems = await kitRepo.findAll({ user_id: 'kit-user' });
        assert(kitItems.length === 3, 'Should have 3 kit items');

        // Calculate budget
        // Expected: (45*5) + (1200*2) + (180*3) = 225 + 2400 + 540 = 3165
        const budget = await kitRepo.calculateBudget('kit-user');
        assert(budget.total === 3165.0, `Should calculate correct total (expected 3165, got ${budget.total})`);
        assert(budget.items.length === 3, 'Should include all items in budget');
        assert(budget.items[0].subtotal === 225.0, 'Should calculate subtotal correctly');

        // ===========================================================================
        // T5: USER PREFERENCES REPOSITORY
        // ===========================================================================
        console.log('\nT5: User Preferences Repository');
        console.log('-'.repeat(60));

        const prefRepo = new UserPreferencesRepository();

        // Create preferences
        await prefRepo.upsert('pref-user', { theme: 'dark', lang: 'pt' });
        const prefs1 = await prefRepo.getPreferences('pref-user');
        assert(prefs1.theme === 'dark', 'Should save preferences');

        // Update (upsert)
        await prefRepo.upsert('pref-user', { theme: 'light', notifications: true });
        const prefs2 = await prefRepo.getPreferences('pref-user');
        assert(prefs2.theme === 'light', 'Should update preferences');
        assert(prefs2.notifications === true, 'Should add new fields');

        // Context tags
        const tags = await prefRepo.updateContextTags('pref-user', ['hospital', 'clinic']);
        assert(tags.length === 2, 'Should update context tags');

        const prefs3 = await prefRepo.getPreferences('pref-user');
        assert(Array.isArray(prefs3.context_tags), 'Should store context tags');
        assert(prefs3.context_tags.length === 2, 'Should have 2 tags');

        // ===========================================================================
        // T6: EDGE CASES
        // ===========================================================================
        console.log('\nT6: Edge Cases');
        console.log('-'.repeat(60));

        // Null price
        await kitRepo.create({
            user_id: 'edge-user',
            item_name: 'Free Item',
            price: null,
            qty: 10,
        });

        const budgetNull = await kitRepo.calculateBudget('edge-user');
        assert(budgetNull.total === 0, 'Should handle null price as zero');

        // Empty query
        const emptyHistory = await historyRepo.findAll({ user_id: 'nonexistent' });
        assert(emptyHistory.length === 0, 'Should return empty array for nonexistent user');

        // Special characters
        await historyRepo.logSearch('special-user', 'Test "quotes" & <tags>', 1);
        const specialHistory = await historyRepo.findAll({ user_id: 'special-user' });
        assert(specialHistory.length === 1, 'Should handle special characters');
        assert(specialHistory[0].query.includes('"quotes"'), 'Should preserve quotes');

    } catch (error) {
        console.error('\n❌ Test failed with error:', error);
        testsFailed++;
    } finally {
        await closeDatabase();
    }

    // ===========================================================================
    // RESULTS
    // ===========================================================================
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESULTADOS DOS TESTES');
    console.log('='.repeat(60));
    console.log(`✅ Passed: ${testsPassed}`);
    console.log(`❌ Failed: ${testsFailed}`);
    console.log(`📈 Success Rate: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%`);
    console.log('='.repeat(60));

    if (testsFailed === 0) {
        console.log('\n🎉 TODOS OS TESTES PASSARAM! FASE 1 COMPLETA!\n');
        process.exit(0);
    } else {
        console.log('\n⚠️  Alguns testes falharam. Revise a implementação.\n');
        process.exit(1);
    }
}

// Run tests
runTests().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
