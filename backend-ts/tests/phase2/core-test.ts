/**
 * FASE 2 - Simplified E2E Tests
 * 
 * Core functionality tests only
 */

import 'reflect-metadata';
import { initializeDatabase, closeDatabase } from '../../src/infra/database/connection.js';
import { SearchHistoryRepository } from '../../src/domain/repositories/SearchHistoryRepository.js';
import { FavoritesRepository } from '../../src/domain/repositories/FavoritesRepository.js';

const products = [
    { name: 'Mop Industrial 60cm', price: 45.0 },
    { name: 'Lavadora Piso', price: 1200.0 },
    { name: 'Escada 3 Degraus', price: 180.0 },
];

let passed = 0;
let failed = 0;

function test(condition: boolean, msg: string) {
    if (condition) {
        console.log(`✅ ${msg}`);
        passed++;
    } else {
        console.log(`❌ ${msg}`);
        failed++;
    }
}

async function run() {
    console.log('\n🧪 FASE 2 - Core Tests\n');

    try {
        await initializeDatabase();

        // HISTORY TESTS
        console.log('History Tests:');
        const histRepo = new SearchHistoryRepository();

        await histRepo.logSearch('user1', products[0].name, 10);
        await histRepo.logSearch('user1', products[1].name, 5);

        const hist = await histRepo.findAll({ user_id: 'user1' });
        test(hist.length === 2, 'Should log 2 searches');
        test(hist[0].results_count === 5, 'Should store results_count');

        // FAVORITES TESTS
        console.log('\nFavorites Tests:');
        const favRepo = new FavoritesRepository();

        const fav1 = await favRepo.create({
            user_id: 'user1',
            item_name: products[0].name,
            price: products[0].price,
        });
        test(fav1.id > 0, 'Should create favorite');

        await favRepo.create({
            user_id: 'user1',
            item_name: products[1].name,
            price: products[1].price,
        });

        const favs = await favRepo.findAll({ user_id: 'user1' });
        test(favs.length === 2, 'Should list 2 favorites');

        const deleted = await favRepo.deleteByIdAndUser(fav1.id, 'user1');
        test(deleted === true, 'Should delete favorite');

        const favsAfter = await favRepo.findAll({ user_id: 'user1' });
        test(favsAfter.length === 1, 'Should have 1 favorite after delete');

    } catch (error) {
        console.error('Error:', error);
        failed++;
    } finally {
        await closeDatabase();
    }

    console.log(`\n📊 Results: ✅ ${passed} | ❌ ${failed}`);

    if (failed === 0) {
        console.log('🎉 ALL TESTS PASSED!\n');
        process.exit(0);
    } else {
        process.exit(1);
    }
}

run();
