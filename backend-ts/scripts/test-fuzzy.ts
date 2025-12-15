/**
 * Quick validation test for fuzzy matcher
 */

import { FuzzyMatcher } from '../src/domain/fuzzyMatcher.js';

console.log('=== Testing Fuzzy Matcher ===\n');

const vocabulary = ['lavadora', 'aspirador', 'mop', 'carrinho', 'balde', 'industrial'];
const matcher = new FuzzyMatcher(vocabulary);

const tests = [
    { input: 'lavadora', expected: 'lavadora' },
    { input: 'lavdora', expected: 'lavadora' },
    { input: 'aspiradro', expected: 'aspirador' },
    { input: 'carrino', expected: 'carrinho' },
    { input: 'xyz', expected: 'xyz' }, // No match, returns original
];

let passed = 0;
let failed = 0;

for (const test of tests) {
    const result = matcher.correct(test.input);
    const status = result === test.expected ? '✓' : '✗';

    if (result === test.expected) {
        passed++;
        console.log(`${status} "${test.input}" → "${result}"`);
    } else {
        failed++;
        console.log(`${status} "${test.input}" → "${result}" (expected: "${test.expected}")`);
    }
}

console.log(`\n${passed} passed, ${failed} failed`);

// Test query correction
console.log('\n=== Query Correction ===\n');
const queryResult = matcher.correctQuery('lavdora industrial');
console.log(`Input: "lavdora industrial"`);
console.log(`Output: "${queryResult.corrected}"`);
console.log(`Corrections:`, queryResult.corrections);
console.log(`Has corrections: ${queryResult.hasCorrections}`);

process.exit(failed > 0 ? 1 : 0);
