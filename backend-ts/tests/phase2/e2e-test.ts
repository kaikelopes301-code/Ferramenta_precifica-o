/**
 * FASE 2 - E2E Tests
 * 
 * Comprehensive test suite for History and Favorites HTTP endpoints
 * using real product data.
 */

import 'reflect-metadata';
import { initializeDatabase, closeDatabase } from '../../src/infra/database/connection.js';
import { SearchHistoryRepository } from '../../src/domain/repositories/SearchHistoryRepository.js';
import { FavoritesRepository } from '../../src/domain/repositories/FavoritesRepository.js';

// Real products from cleaning equipment dataset
const testProducts = [
    { name: 'Mop Industrial 60cm', price: 45.0, life: 24, maint: 5.0 },
    { name: 'Lavadora de Piso Profissional', price: 1200.0, life: 60, maint: 8.0 },
    { name: 'Escada Alumínio 3 Degraus', price: 180.0, life: 36, maint: 3.0 },
    { name: 'Carrinho Plataforma 200kg', price: 350.0, life: 48, maint: 4.0 },
    { name: 'Rodo Plástico 40cm', price: 25.0, life: 12, maint: 10.0 },
    { name: 'Balde 20 litros', price: 35.0, life: 18, maint: 8.0 },
    { name: 'Luva Látex M', price: 12.0, life: 3, maint: 15.0 },
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
    console.log('\n🧪 FASE 2 - Testes E2E: Histórico + Favoritos\n');
    console.log('='.repeat(70));

    try {
        await initializeDatabase();

        // ===========================================================================
        // T1: HISTORY ENDPOINT SIMULATION
        // ===========================================================================
        console.log('\nT1: GET /api/history - Histórico de Buscas');
        console.log('-'.repeat(70));

        const historyRepo = new SearchHistoryRepository();

        // Simular usuário fazendo 5 buscas
        const user1 = 'user-test-1';
        await historyRepo.logSearch(user1, testProducts[0].name, 10);
        await new Promise(r => setTimeout(r, 10));
        await historyRepo.logSearch(user1, testProducts[1].name, 5);
        await new Promise(r => setTimeout(r, 10));
        await historyRepo.logSearch(user1, testProducts[2].name, 8);
        await new Promise(r => setTimeout(r, 10));
        await historyRepo.logSearch(user1, testProducts[3].name, 12);
        await new Promise(r => setTimeout(r, 10));
        await historyRepo.logSearch(user1, testProducts[4].name, 3);

        // Test 1.1: List all history (default limit)
        const history1 = await historyRepo.findAll({ user_id: user1 });
        assert(history1.length === 5, 'Should return 5 search history items');
        assert(history1[0].query === testProducts[4].name, 'Should order by date DESC (most recent first)');

        // Test 1.2: Respect limit parameter
        const history2 = await historyRepo.findAll({ user_id: user1, limit: 3 });
        assert(history2.length === 3, 'Should respect limit=3');

        // Test 1.3: User isolation
        const user2 = 'user-test-2';
        await historyRepo.logSearch(user2, 'Other user query', 5);

        const user1History = await historyRepo.findAll({ user_id: user1 });
        const user2History = await historyRepo.findAll({ user_id: user2 });

        assert(user1History.length === 5, 'User 1 should have 5 items');
        assert(user2History.length === 1, 'User 2 should have 1 item');
        assert(!user2History.some(h => h.query.includes('Mop')), 'User 2 should not see User 1 searches');

        // Test 1.4: Empty history
        const emptyHistory = await historyRepo.findAll({ user_id: 'nonexistent-user' });
        assert(emptyHistory.length === 0, 'Should return empty array for new user');

        // Test 1.5: Results count accuracy
        assert(history1[0].results_count === 3, 'Should store correct results_count');
        assert(history1[1].results_count === 12, 'Should store correct results_count');

        // ===========================================================================
        // T2: FAVORITES ENDPOINTS SIMULATION
        // ===========================================================================
        console.log('\nT2: POST /api/favorites - Adicionar Favoritos');
        console.log('-'.repeat(70));

        const favRepo = new FavoritesRepository();
        const favUser = 'fav-user-test';

        // Test 2.1: Add multiple favorites
        const fav1 = await favRepo.create({
            user_id: favUser,
            item_name: testProducts[0].name,
            price: testProducts[0].price,
            extra: JSON.stringify({ life: testProducts[0].life, maint: testProducts[0].maint }),
        });
        assert(fav1.id > 0, 'Should create favorite with ID');

        const fav2 = await favRepo.create({
            user_id: favUser,
            item_name: testProducts[1].name,
            price: testProducts[1].price,
        });

        const fav3 = await favRepo.create({
            user_id: favUser,
            item_name: testProducts[2].name,
            price: testProducts[2].price,
            extra: JSON.stringify({ notes: 'Ótima escada!' }),
        });

        // ===========================================================================
        // T3: GET /api/favorites - Listar Favoritos
        // ===========================================================================
        console.log('\nT3: GET /api/favorites - Listar Favoritos');
        console.log('-'.repeat(70));

        // Test 3.1: List all favorites
        const favs = await favRepo.findAll({ user_id: favUser });
        assert(favs.length === 3, 'Should have 3 favorites');

        // Test 3.2: Verify data integrity
        const mopFav = favs.find(f => f.item_name.includes('Mop'));
        assert(mopFav !== undefined, 'Should find Mop in favorites');
        assert(mopFav!.price === 45.0, 'Should store correct price');

        // Test 3.3: Parse extra JSON
        if (mopFav!.extra) {
            const extra = JSON.parse(mopFav!.extra);
            assert(extra.life === 24, 'Should parse extra JSON correctly');
            assert(extra.maint === 5.0, 'Should preserve all extra fields');
        }

        // Test 3.4: User isolation for favorites
        const otherUser = 'other-fav-user';
        await favRepo.create({
            user_id: otherUser,
            item_name: 'Other User Item',
            price: 999,
        });

        const favUser1Favs = await favRepo.findAll({ user_id: favUser });
        const favUser2Favs = await favRepo.findAll({ user_id: otherUser });

        assert(favUser1Favs.length === 3, 'User 1 should still have 3 favorites');
        assert(favUser2Favs.length === 1, 'User 2 should have 1 favorite');

        // ===========================================================================
        // T4: DELETE /api/favorites/:id - Remover Favorito
        // ===========================================================================
        console.log('\nT4: DELETE /api/favorites/:id - Remover Favorito');
        console.log('-'.repeat(70));

        // Test 4.1: Delete own favorite
        const deleted1 = await favRepo.deleteByIdAndUser(fav1.id, favUser);
        assert(deleted1 === true, 'Should delete own favorite');

        const favsAfter = await favRepo.findAll({ user_id: favUser });
        assert(favsAfter.length === 2, 'Should have 2 favorites after deletion');

        // Test 4.2: Cannot delete other user's favorite
        const otherUserFav = await favRepo.findAll({ user_id: otherUser });
        const deleted2 = await favRepo.deleteByIdAndUser(otherUserFav[0].id, favUser);
        assert(deleted2 === false, 'Should not delete other user\'s favorite');

        const otherStillHas = await favRepo.findAll({ user_id: otherUser });
        assert(otherStillHas.length === 1, 'Other user should still have favorite');

        // Test 4.3: Delete non-existent favorite
        const deleted3 = await favRepo.deleteByIdAndUser(99999, favUser);
        assert(deleted3 === false, 'Should return false for non-existent favorite');

        // ===========================================================================
        // T5: EDGE CASES & VALIDATION
        // ===========================================================================
        console.log('\nT5: Edge Cases & Validation');
        console.log('-'.repeat(70));

        // Test 5.1: Favorites with null price
        const nullPriceFav = await favRepo.create({
            user_id: favUser,
            item_name: 'Free Sample',
            price: null,
        });
        assert(nullPriceFav.price === null, 'Should accept null price');

        // Test 5.2: Favorites with special characters
        const specialFav = await favRepo.create({
            user_id: favUser,
            item_name: 'Item "Especial" & <Tags>',
            price: 10,
        });
        assert(specialFav.item_name.includes('"Especial"'), 'Should handle special characters');

        // Test 5.3: Large extra JSON
        const largeExtra = {
            specs: Array.from({ length: 50 }, (_, i) => ({ key: `spec-${i}`, value: `value-${i}` })),
        };
        const largeFav = await favRepo.create({
            user_id: favUser,
            item_name: 'Complex Item',
            price: 100,
            extra: JSON.stringify(largeExtra),
        });
        const parsedLarge = JSON.parse(largeFav.extra!);
        assert(parsedLarge.specs.length === 50, 'Should handle large JSON extra');

        // ===========================================================================
        // T6: REAL-WORLD SCENARIO
        // ===========================================================================
        console.log('\nT6: Real-World User Journey');
        console.log('-'.repeat(70));

        // Scenario: User procura por produtos, favorita alguns, checa histórico
        const realUser = 'real-journey-user';

        // 1. Faz 3 buscas
        await historyRepo.logSearch(realUser, testProducts[5].name, 8);
        await historyRepo.logSearch(realUser, testProducts[6].name, 15);
        await historyRepo.logSearch(realUser, testProducts[0].name, 10);

        // 2. Adiciona 2 favoritos dos resultados
        await favRepo.create({
            user_id: realUser,
            item_name: testProducts[5].name,
            price: testProducts[5].price,
        });
        await favRepo.create({
            user_id: realUser,
            item_name: testProducts[0].name,
            price: testProducts[0].price,
        });

        // 3. Verifica histórico
        const userHistory = await historyRepo.findAll({ user_id: realUser });
        assert(userHistory.length === 3, 'User journey: Should have 3 searches in history');

        // 4. Verifica favoritos
        const userFavs = await favRepo.findAll({ user_id: realUser });
        assert(userFavs.length === 2, 'User journey: Should have 2 favorites');

        // 5. Remove 1 favorito
        await favRepo.deleteByIdAndUser(userFavs[0].id, realUser);
        const userFavsAfter = await favRepo.findAll({ user_id: realUser });
        assert(userFavsAfter.length === 1, 'User journey: Should have 1 favorite after removal');

    } catch (error) {
        console.error('\n❌ Test failed with error:', error);
        testsFailed++;
    } finally {
        await closeDatabase();
    }

    // ===========================================================================
    // RESULTS
    // ===========================================================================
    console.log('\n' + '='.repeat(70));
    console.log('📊 RESULTADOS DOS TESTES - FASE 2');
    console.log('='.repeat(70));
    console.log(`✅ Passed: ${testsPassed}`);
    console.log(`❌ Failed: ${testsFailed}`);
    console.log(`📈 Success Rate: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%`);
    console.log('='.repeat(70));

    if (testsFailed === 0) {
        console.log('\n🎉 TODOS OS TESTES PASSARAM! FASE 2 COMPLETA!\n');
        process.exit(0);
    } else {
        console.log('\n⚠️  Alguns testes falharam. Revise a implementação.\n');
        process.exit(1);
    }
}

runTests().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
