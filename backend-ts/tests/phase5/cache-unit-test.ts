
import { IntegratedSearchEngine } from '../../src/domain/integratedSearch.js';
import { BM25Document } from '../../src/domain/bm25.js';

const documents: BM25Document[] = [
    { id: '1', text: 'mop de limpeza industrial' },
    { id: '2', text: 'aspirador de pó profissional' },
    { id: '3', text: 'carrinho de limpeza funcional' },
    { id: '4', text: 'balde espremedor amarelo' }
];

async function runTest() {
    console.log('🧪 Testing Integrated Search LRU Cache...\n');

    const engine = new IntegratedSearchEngine({ documents });
    console.log('✅ Engine initialized');

    // Test 1: First Query (Miss)
    console.log('\n🔍 Query 1: "mop" (Cache Miss)');
    const start1 = performance.now();
    const results1 = engine.search('mop');
    const end1 = performance.now();
    console.log(`   Time: ${(end1 - start1).toFixed(4)}ms`);
    console.log(`   Results: ${results1.length}`);

    const stats1 = engine.getStats();
    console.log(`   Cache Size: ${stats1.cache.size}`);

    if (stats1.cache.size !== 1) {
        console.error('❌ FAIL: Cache size should be 1');
        process.exit(1);
    }

    // Test 2: Same Query (Hit)
    console.log('\n🔍 Query 2: "mop" (Cache Hit)');
    const start2 = performance.now();
    const results2 = engine.search('mop');
    const end2 = performance.now();
    console.log(`   Time: ${(end2 - start2).toFixed(4)}ms`);

    if (end2 - start2 > 1.0) { // Should be practically instant
        console.warn('⚠️ WARNING: Cache hit took > 1ms');
    }

    // Check integrity
    if (JSON.stringify(results1) !== JSON.stringify(results2)) {
        console.error('❌ FAIL: Cached results differ from original');
        process.exit(1);
    }
    console.log('✅ Matches original results');

    // Test 3: Normalized Query (Hit)
    console.log('\n🔍 Query 3: "  MOP  " (Cache Hit via Normalization)');
    const start3 = performance.now();
    engine.search('  MOP  ');
    const end3 = performance.now();
    console.log(`   Time: ${(end3 - start3).toFixed(4)}ms`);

    const stats3 = engine.getStats();
    if (stats3.cache.size !== 1) {
        console.error(`❌ FAIL: Cache size increased (${stats3.cache.size}) - Normalization failed`);
        process.exit(1);
    }
    console.log('✅ Cache size remained 1');

    // Test 4: New Query (Miss)
    console.log('\n🔍 Query 4: "aspirador" (Cache Miss)');
    engine.search('aspirador');

    const stats4 = engine.getStats();
    if (stats4.cache.size !== 2) {
        console.error(`❌ FAIL: Cache size should be 2, got ${stats4.cache.size}`);
        process.exit(1);
    }
    console.log('✅ Cache size increased to 2');

    console.log('\n🎉 ALL CACHE TESTS PASSED!');
}

runTest();
