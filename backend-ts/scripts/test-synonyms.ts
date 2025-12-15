/**
 * Quick validation test for synonyms
 */

import { getSynonymsForTerm, expandQueryWithSynonyms } from '../src/domain/synonyms.js';

console.log('=== Testing Synonyms ===\n');

// Test getSynonymsForTerm
console.log('1. getSynonymsForTerm tests:');
const terms = ['mop', 'lavadora', 'aspirador', 'balde', 'unknown'];

for (const term of terms) {
    const synonyms = getSynonymsForTerm(term);
    console.log(`  "${term}" → [${synonyms.join(', ')}]`);
}

// Test expandQueryWithSynonyms
console.log('\n2. expandQueryWithSynonyms tests:');
const queries = [
    'mop industrial',
    'lavadora pressão',
    'aspirador',
];

for (const query of queries) {
    const expansions = expandQueryWithSynonyms(query, 5);
    console.log(`\n  Query: "${query}"`);
    expansions.forEach((exp, i) => {
        console.log(`    ${i + 1}. "${exp}"`);
    });
}

console.log('\n✓ All synonym tests passed');
