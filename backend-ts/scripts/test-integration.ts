/**
 * End-to-End Integration Test
 * 
 * Tests the complete search pipeline with real-world scenarios
 */

import { createIntegratedSearchEngine } from '../src/domain/integratedSearch.js';

console.log('=== INTEGRATED SEARCH PIPELINE TEST ===\n');

// Sample corpus (realistic equipment data)
const corpus = [
    { id: 'eq001', text: 'mop industrial microfibra 60cm' },
    { id: 'eq002', text: 'lavadora de piso industrial alta pressão' },
    { id: 'eq003', text: 'aspirador de pó industrial 1400w' },
    { id: 'eq004', text: 'carrinho de limpeza industrial com balde' },
    { id: 'eq005', text: 'vassoura industrial piaçava 40cm' },
    { id: 'eq006', text: 'balde plástico 20 litros' },
    { id: 'eq007', text: 'esfregão microfibra profissional' },
    { id: 'eq008', text: 'máquina lavar piso 220v' },
    { id: 'eq009', text: 'vacuum cleaner 1400w' },
];

// Create search engine
const searchEngine = createIntegratedSearchEngine(corpus);

console.log('Engine Stats:');
const stats = searchEngine.getStats();
console.log(`- Documents: ${stats.documentCount}`);
console.log(`- Vocabulary size: ${stats.vocabularySize}`);
console.log(`- Fuzzy enabled: ${stats.config.enableFuzzy}`);
console.log(`- Synonyms enabled: ${stats.config.enableSynonyms}`);
console.log('');

// Test cases
const testCases = [
    {
        name: 'Exact match',
        query: 'mop industrial',
        expectedTopId: 'eq001',
    },
    {
        name: 'Synonym expansion (esfregão → mop)',
        query: 'esfregão industrial',
        expectedTopId: 'eq001', // Should find "mop industrial" via synonyms
    },
    {
        name: 'Typo correction',
        query: 'lavdora piso', // "lavdora" should correct to "lavadora"
        expectedTopIds: ['eq002', 'eq008'],
    },
    {
        name: 'Synonym + BM25',
        query: 'vacuum', // Should find "aspirador" via synonyms
        expectedTopIds: ['eq003', 'eq009'],
    },
    {
        name: 'Complex query with typos and synonyms',
        query: 'aspiradro industrial', // typo + should boost industrial ones
        expectedTopId: 'eq003',
    },
];

let passed = 0;
let failed = 0;

for (const test of testCases) {
    console.log(`Test: ${test.name}`);
    console.log(`Query: "${test.query}"`);

    const results = searchEngine.search(test.query, 5);

    console.log(`Results (top 3):`);
    results.slice(0, 3).forEach((r, i) => {
        console.log(`  ${i + 1}. ${r.id} (score: ${r.score.toFixed(3)})`);
    });

    if (results[0]?.debug) {
        console.log(`Debug:`);
        console.log(`  - Fuzzy corrections: ${results[0].debug.hasFuzzyCorrections}`);
        console.log(`  - Corrected query: ${results[0].correctedQuery || 'none'}`);
        console.log(`  - Synonym variants: ${results[0].queryVariants.length}`);
    }

    // Validation
    let testPassed = false;
    if ('expectedTopId' in test) {
        testPassed = results[0]?.id === test.expectedTopId;
    } else if ('expectedTopIds' in test) {
        testPassed = test.expectedTopIds!.includes(results[0]?.id || '');
    }

    if (testPassed) {
        console.log(`✓ PASSED\n`);
        passed++;
    } else {
        console.log(`✗ FAILED - Expected ${test.expectedTopId || test.expectedTopIds?.join(' or ')}, got ${results[0]?.id}\n`);
        failed++;
    }
}

console.log('='.repeat(60));
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));

if (failed === 0) {
    console.log('\n✅ ALL INTEGRATION TESTS PASSED!\n');
    process.exit(0);
} else {
    console.log('\n⚠️  Some tests failed (may need parameter tuning)\n');
    process.exit(1);
}
